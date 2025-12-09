import * as admin from "firebase-admin";

// Ensure the default app exists before grabbing Firestore, since this file is
// imported before some callers run initializeApp().
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface VelocityRule {
  windowMs: number;
  max: number;
  label: string;
}

const VELOCITY_RULES: VelocityRule[] = [
  { windowMs: 15 * 60 * 1000, max: 8, label: "15m" }, // max 8 credits in 15 minutes
  { windowMs: 60 * 60 * 1000, max: 20, label: "1h" }, // max 20 credits per hour
  { windowMs: 24 * 60 * 60 * 1000, max: 120, label: "24h" }, // max 120 per day
];

const MAX_SAMPLED_EVENTS = 200;

export interface VelocityCheckResult {
  blocked: boolean;
  reasons: string[];
  counts: Record<string, number>;
  sampled: number;
}

/**
 * Lightweight velocity check that looks at the user's offer history
 * within the largest window and enforces coarse limits to deter scripted abuse.
 */
export const checkOfferVelocity = async (
  uid: string,
  source: string
): Promise<VelocityCheckResult> => {
  if (!uid) {
    return { blocked: false, reasons: [], counts: {}, sampled: 0 };
  }

  const maxWindow = Math.max(...VELOCITY_RULES.map((r) => r.windowMs));
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - maxWindow);

  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("offers")
    .where("createdAt", ">", cutoff)
    .orderBy("createdAt", "desc")
    .limit(MAX_SAMPLED_EVENTS)
    .get();

  const now = Date.now();
  const timestamps: number[] = snap.docs
    .map((d) => {
      const ts = d.data().createdAt as admin.firestore.Timestamp | undefined;
      return ts?.toMillis();
    })
    .filter((t): t is number => typeof t === "number");

  const counts: Record<string, number> = {};
  for (const rule of VELOCITY_RULES) {
    const threshold = now - rule.windowMs;
    counts[rule.label] = timestamps.filter((t) => t >= threshold).length;
  }

  const reasons = VELOCITY_RULES.filter(
    (rule) => counts[rule.label] >= rule.max
  ).map((rule) => `${rule.label} >= ${rule.max}`);

  const blocked = reasons.length > 0;

  return {
    blocked,
    reasons,
    counts,
    sampled: timestamps.length,
  };
};

export const logVelocityBlock = async (opts: {
  uid: string;
  source: string;
  txId?: string | null;
  amount?: number | null;
  counts?: Record<string, number>;
  reasons: string[];
}) => {
  const { uid, source, txId, amount, counts, reasons } = opts;
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  await db.collection("fraudLogs").add({
    type: "velocity",
    uid,
    source,
    txId: txId || null,
    amount: amount ?? null,
    counts: counts || null,
    reasons,
    createdAt: serverNow,
  });
};
