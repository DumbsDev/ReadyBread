import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

/* ============================================================
   STREAK BONUS + REVENUE SHARE HELPERS
   - bonusPercent is the user's DAILY STREAK bonus (0–10%)
   - basePayout is the FULL partner payout (100%)
   - user gets (50% + bonusPercent)% of basePayout
   - owner gets (50% - bonusPercent)% of basePayout
============================================================ */

function clampBonusPercent(raw: any): number {
  if (typeof raw !== "number" || !isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > 10) return 10; // cap streak bonus at +10%
  return raw;
}

/**
 * Unified revenue sharing:
 * - partner sends basePayout (100% of revenue)
 * - userPercent = 50% + bonusPercent
 * - ownerPercent = 50% - bonusPercent
 *
 * Returns:
 * - base: full partner payout (100%)
 * - baseUserAmount: user's baseline 50% share of partner payout
 * - final: user's actual credited amount (50%–60%)
 * - bonusAmount: extra above the baseline 50% share
 * - bonusPercent: streak bonus %
 * - userPercent: actual user % of partner payout (50–60)
 */
function applyRevenueShare(basePayout: number, bonusPercentRaw: any) {
  const bonusPercent = clampBonusPercent(bonusPercentRaw); // 0–10
  const userPercentFraction = (50 + bonusPercent) / 100; // 0.5–0.6

  const finalRaw = basePayout * userPercentFraction;
  const final = Math.round(finalRaw * 100) / 100; // round to cents

  const baseUserRaw = basePayout * 0.5; // baseline 50% share
  const baseUserAmount = Math.round(baseUserRaw * 100) / 100;

  const bonusAmountRaw = final - baseUserAmount; // always >= 0
  const bonusAmount = Math.round(bonusAmountRaw * 100) / 100;

  return {
    base: basePayout, // full partner payout (100%)
    baseUserAmount,
    bonusPercent,
    userPercent: userPercentFraction * 100, // 50–60 as %
    final,
    bonusAmount,
  };
}

/* ============================================================
   SECRETS
============================================================ */
const OFFERS_SECRET = defineSecret("OFFERS_SECRET");
const REVU_SECRET = defineSecret("REVU_SECRET");
// KiwiWall secret key (used for MD5 verification). Can be overridden with env KIWI_SECRET.
const KIWI_SECRET_VALUE =
  process.env.KIWI_SECRET || "26b6e44ad5b4e320f03ed0b71b1c398c";
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const SENDGRID_FROM_EMAIL = defineSecret("SENDGRID_FROM_EMAIL");

////////////////////////////////////////////////////////////////////////////////
//  ADGEM WEBHOOK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////

export const adgemWebhook = onRequest(
  { secrets: [OFFERS_SECRET], region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      const secretFromRequest =
        (req.query.secret as string) ?? (req.body && req.body.secret);
      const expectedSecret = OFFERS_SECRET.value();

      if (!secretFromRequest || secretFromRequest !== expectedSecret) {
        console.warn("Invalid secret on AdGem webhook:", secretFromRequest);
        res.status(403).send("Forbidden");
        return;
      }

      const uid =
        (req.query.uid as string) ??
        (req.query.sub_id as string) ??
        (req.query.user_id as string) ??
        (req.body && (req.body.uid || req.body.sub_id || req.body.user_id));

      const offerId =
        (req.query.offer_id as string) ?? (req.body && req.body.offer_id);

      const amountRaw =
        (req.query.amount as string) ?? (req.body && req.body.amount);

      const txId =
        (req.query.transaction_id as string) ??
        (req.body && req.body.transaction_id);

      if (!uid || !offerId || !amountRaw || !txId) {
        res
          .status(400)
          .send("Missing uid / offerId / amount / transaction_id");
        return;
      }

      // AdGem sends cents; convert to USD
      const basePayout = Number(amountRaw) / 100;
      if (!isFinite(basePayout) || basePayout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      const txRef = db.collection("completedOffers").doc(txId);
      const txSnap = await txRef.get();

      // Prevent double credit
      if (txSnap.exists) {
        res.status(200).send("OK (duplicate ignored)");
        return;
      }

      await db.runTransaction(async (t) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await t.get(userRef);

        const now = admin.firestore.Timestamp.now();
        const serverNow = admin.firestore.FieldValue.serverTimestamp();

        const bonusPercentRaw = userSnap.exists
          ? userSnap.data()?.bonusPercent
          : 0;

        const {
          base,
          baseUserAmount,
          final,
          bonusAmount,
          bonusPercent,
          userPercent,
        } = applyRevenueShare(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "adgem",
            offerId,
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            txId,
            at: now,
          }),
        };

        if (!userSnap.exists) {
          t.set(
            userRef,
            { createdAt: serverNow, ...balanceUpdate },
            { merge: true }
          );
        } else {
          t.update(userRef, balanceUpdate);
        }

        t.set(
          userRef.collection("offers").doc(),
          {
            offerId,
            type: "adgem",
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            txId,
            createdAt: serverNow,
          },
          { merge: true }
        );

        t.set(txRef, {
          uid,
          offerId,
          payout: final,
          baseAmount: base,
          userBaseAmount: baseUserAmount,
          bonusAmount,
          bonusPercent,
          userPercent,
          source: "AdGem",
          txId,
          creditedAt: serverNow,
        });
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("Error in adgemWebhook:", err);
      res.status(500).send("Internal error");
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
//  KIWIWALL POSTBACK (Offerwall) with signature check + revenue share
////////////////////////////////////////////////////////////////////////////////

function getKiwiwallParam(raw: any): string {
  if (raw === undefined || raw === null) return "";
  if (Array.isArray(raw)) {
    const last = raw[raw.length - 1];
    return last === undefined || last === null ? "" : String(last);
  }
  return String(raw);
}

function getKiwiwallSignatures(raw: any): string[] {
  if (raw === undefined || raw === null) return [];

  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function verifyKiwiwallSignature(params: any, secret: string) {
  const providedSignatures = getKiwiwallSignatures(params.signature);

  const subId =
    getKiwiwallParam(params.sub_id) ||
    getKiwiwallParam(params.uid) ||
    getKiwiwallParam(params.subid) ||
    getKiwiwallParam(params.user_id);

  const amount = getKiwiwallParam(params.amount);

  if (!subId || !amount || providedSignatures.length === 0) {
    return false;
  }

  const expectedSignature = crypto
    .createHash("md5")
    .update(`${subId}:${amount}:${secret}`)
    .digest("hex")
    .toLowerCase();

  const normalizedProvided = providedSignatures.map((sig) =>
    sig.toLowerCase()
  );

  return (
    normalizedProvided.includes(expectedSignature) ||
    normalizedProvided.includes(secret.toLowerCase())
  );
}

export const kiwiwallPostback = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      const kiwiParams =
        req.method === "POST"
          ? { ...req.query, ...req.body }
          : { ...req.query };

      const uid =
        getKiwiwallParam(kiwiParams.uid) ||
        getKiwiwallParam(kiwiParams.sub_id) ||
        getKiwiwallParam(kiwiParams.subid) ||
        getKiwiwallParam(kiwiParams.user_id) ||
        "";

      const txId =
        getKiwiwallParam(kiwiParams.tx) ||
        getKiwiwallParam(kiwiParams.trans_id) ||
        "";

      const offerId = getKiwiwallParam(kiwiParams.offer_id) || "";
      const status = getKiwiwallParam(kiwiParams.status) || "";
      const amountRaw = getKiwiwallParam(kiwiParams.amount) || "";

      if (!uid || !txId || !offerId || !amountRaw) {
        res.status(400).send("Missing parameters");
        return;
      }

      const sigOk = verifyKiwiwallSignature(kiwiParams, KIWI_SECRET_VALUE);

      if (!sigOk) {
        console.warn("KiwiWall invalid signature", {
          params: kiwiParams,
          providedSignature: kiwiParams.signature,
        });
        res.status(403).send("Invalid signature");

        return;
      }

      // Only process completed conversions
      if (status !== "1") {
        console.log("Kiwiwall reversal or invalid status:", status);
        res.status(200).send("1"); // acknowledge non-paid to prevent retries
        return;
      }

      const basePayout = Number(amountRaw);
      if (!isFinite(basePayout) || basePayout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      // Prevent duplicate transactions
      const txRef = db.collection("completedOffers").doc(String(txId));
      const existingTx = await txRef.get();
      if (existingTx.exists) {
        res.status(200).send("1");
        return;
      }

      await db.runTransaction(async (t) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await t.get(userRef);

        const now = admin.firestore.Timestamp.now();
        const serverNow = admin.firestore.FieldValue.serverTimestamp();

        const bonusPercentRaw = userSnap.exists
          ? userSnap.data()?.bonusPercent
          : 0;

        const {
          base,
          baseUserAmount,
          final,
          bonusAmount,
          bonusPercent,
          userPercent,
        } = applyRevenueShare(basePayout, bonusPercentRaw);

        // Update user balance
        if (userSnap.exists) {
          t.update(userRef, {
            balance: admin.firestore.FieldValue.increment(final),
            auditLog: admin.firestore.FieldValue.arrayUnion({
              type: "kiwiwall",
              offerId,
              amount: final,
              baseAmount: base,
              userBaseAmount: baseUserAmount,
              bonusAmount,
              bonusPercent,
              userPercent,
              txId,
              at: now,
            }),
          });
        } else {
          t.set(
            userRef,
            {
              balance: final,
              createdAt: serverNow,
              auditLog: [
                {
                  type: "kiwiwall",
                  offerId,
                  amount: final,
                  baseAmount: base,
                  userBaseAmount: baseUserAmount,
                  bonusAmount,
                  bonusPercent,
                  userPercent,
                  txId,
                  at: now,
                },
              ],
            },
            { merge: true }
          );
        }

        // Log offer
        t.set(
          userRef.collection("offers").doc(),
          {
            offerId,
            type: "kiwiwall",
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            txId,
            createdAt: serverNow,
          },
          { merge: true }
        );

        // Global offer log
        t.set(
          txRef,
          {
            uid,
            offerId,
            payout: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            source: "KiwiWall",
            txId,
            creditedAt: serverNow,
          },
          { merge: true }
        );
      });

      res.status(200).send("1");
    } catch (err) {
      console.error("KiwiWall callback error:", err);
      res.status(500).send("Internal Server Error");
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
//  REVU OFFERWALL POSTBACK — supports real + TEST FORM
////////////////////////////////////////////////////////////////////////////////

export const revuPostback = onRequest(
  { secrets: [REVU_SECRET], region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      // Merge GET + POST
      const params =
        req.method === "POST"
          ? { ...req.query, ...req.body }
          : { ...req.query };

      // --- Secret Validation ---
      const providedSecret =
        params.secret || params.key || params.token || "";
      const expectedSecret = REVU_SECRET.value();

      if (!providedSecret || providedSecret !== expectedSecret) {
        console.warn("Invalid RevU secret:", providedSecret);
        res.status(403).send("Forbidden");
        return;
      }

      // ==========================================================
      // 1. UID EXTRACTION (special fallback for RevU TEST TOOL)
      // ==========================================================
      let uid =
        params.uid || params.sid || params.user_id || params.sub_id || "";

      // RevU Test Form uses SID2 as UID
      if (!uid && params.sid2) {
        uid = String(params.sid2);
      }

      // ==========================================================
      // 2. PAYOUT EXTRACTION — supports test form (currency)
      // ==========================================================
      let rewardRaw =
        params.rate ||
        params.reward ||
        params.payout ||
        params.amount ||
        params.value ||
        params.goal_reward ||
        "";

      // Test postback uses "currency"
      if (!rewardRaw && params.currency) {
        rewardRaw = params.currency;
      }

      if (!uid || !rewardRaw) {
        console.warn("Missing uid / reward", { uid, rewardRaw, params });
        res.status(400).send("Missing uid / reward");
        return;
      }

      // Convert cents → dollars
      const cents = Number(rewardRaw);
      if (!isFinite(cents) || cents <= 0) {
        res.status(400).send("Invalid reward");
        return;
      }
      const basePayout = Math.round((cents / 100) * 100) / 100;

      // ==========================================================
      // 3. TX ID — test form sends none → generate one
      // ==========================================================
      let txId =
        params.actionid ||
        params.transaction_id ||
        params.tx ||
        params.trans_id ||
        params.oid ||
        null;

      if (!txId) {
        txId = "revu_test_" + Date.now();
      }

      const offerId = params.offer_id || params.campaign || "unknown";
      const sid3 = params.sid3 || params.sub3 || null;

      // ==========================================================
      // 4. Prevent double credit
      // ==========================================================
      const txRef = db.collection("completedOffers").doc(String(txId));
      const existing = await txRef.get();
      if (existing.exists) {
        res.status(200).send("OK (duplicate ignored)");
        return;
      }

      // ==========================================================
      // 5. Revenue Share + Credit User
      // ==========================================================
      await db.runTransaction(async (t) => {
        const userRef = db.collection("users").doc(uid);
        const snap = await t.get(userRef);

        const now = admin.firestore.Timestamp.now();
        const serverNow = admin.firestore.FieldValue.serverTimestamp();

        const bonusPercentRaw = snap.exists ? snap.data()?.bonusPercent : 0;
        const bonusPercent = clampBonusPercent(bonusPercentRaw);

        const userPercent = (50 + bonusPercent) / 100;
        const final = Math.round(basePayout * userPercent * 100) / 100;

        const baseUserAmount = Math.round(basePayout * 0.5 * 100) / 100;
        const bonusAmount = Math.round((final - baseUserAmount) * 100) / 100;

        const update = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "revu",
            offerId,
            amount: final,
            baseAmount: basePayout,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent: userPercent * 100,
            sid3,
            txId,
            at: now,
          }),
        };

        if (!snap.exists) {
          t.set(userRef, { createdAt: serverNow, ...update }, { merge: true });
        } else {
          t.update(userRef, update);
        }

        t.set(
          userRef.collection("offers").doc(),
          {
            offerId,
            type: "revu",
            amount: final,
            baseAmount: basePayout,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent: userPercent * 100,
            sid3,
            txId,
            createdAt: serverNow,
          },
          { merge: true }
        );

        t.set(
          txRef,
          {
            uid,
            offerId,
            payout: final,
            baseAmount: basePayout,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent: userPercent * 100,
            sid3,
            txId,
            creditedAt: serverNow,
            source: "RevU",
          },
          { merge: true }
        );
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("RevU postback error:", err);
      res.status(500).send("Internal error");
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
//  REFERRALS - unchanged
////////////////////////////////////////////////////////////////////////////////

const REFERRAL_REWARD = 0.25;
const REFERRAL_CAP = 2.5;
const ADMIN_REFERRAL_CODE = "NJJK72"; // set to your admin's referralCode
const ADMIN_REFERRAL_BONUS = 1.0; // USD to new user

const processReferralCore = async (uid: string): Promise<string> => {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return "User not found";
  }

  const user = userSnap.data()!;
  const referredBy = user.referredBy || null;

  if (!referredBy) {
    return "No referral code used";
  }

  if (!user.referralPending) {
    return "Referral already resolved";
  }

  const fbUser = await admin.auth().getUser(uid);
  if (!fbUser.emailVerified) {
    return "Email not verified — cannot process referral yet";
  }

  // Special admin/referral-code bonus: pay $1 to the new user, no referrer payout
  if (referredBy === ADMIN_REFERRAL_CODE) {
    await userRef.update({
      balance: admin.firestore.FieldValue.increment(ADMIN_REFERRAL_BONUS),
      referralPending: false,
      auditLog: admin.firestore.FieldValue.arrayUnion({
        type: "admin_referral_bonus",
        amount: ADMIN_REFERRAL_BONUS,
        code: referredBy,
        at: admin.firestore.Timestamp.now(),
      }),
    });
    return "Admin referral bonus applied";
  }

  const refQ = await db
    .collection("users")
    .where("referralCode", "==", referredBy)
    .limit(1)
    .get();

  if (refQ.empty) {
    await userRef.update({ referralPending: false });
    return "Invalid referral code";
  }

  const referrerDoc = refQ.docs[0];
  const referrerId = referrerDoc.id;
  const referrer = referrerDoc.data()!;
  const isAdminReferrer =
    (referrer as any)?.referralCode === ADMIN_REFERRAL_CODE;

  if (referrerId === uid) {
    await userRef.update({ referralPending: false });
    return "Self referral blocked";
  }

  if (referrer.referredBy === user.referralCode) {
    await userRef.update({ referralPending: false });
    return "Circular referral blocked";
  }

  const sameDevice =
    referrer.deviceId &&
    user.deviceId &&
    referrer.deviceId === user.deviceId;

  // ALWAYS pay referred user
  await userRef.update({
    balance: admin.firestore.FieldValue.increment(REFERRAL_REWARD),
  });

  await userRef
    .collection("referrals")
    .doc(referrerId)
    .set({
      referredUserId: uid,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      earningsFromReferral: REFERRAL_REWARD,
    });

  if (sameDevice) {
    await userRef.update({ referralPending: false });
    return "Same-device referral — referrer not paid";
  }

  const currentEarned = referrer.totalReferralEarnings || 0;
  if (!isAdminReferrer && currentEarned >= REFERRAL_CAP) {
    await userRef.update({ referralPending: false });
    return "Referrer at cap";
  }

  await db
    .collection("users")
    .doc(referrerId)
    .update({
      balance: admin.firestore.FieldValue.increment(REFERRAL_REWARD),
      totalReferralEarnings: admin.firestore.FieldValue.increment(
        REFERRAL_REWARD
      ),
    });

  await db
    .collection("users")
    .doc(referrerId)
    .collection("referrals")
    .doc(uid)
    .set({
      referredUserId: uid,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      earningsFromReferral: REFERRAL_REWARD,
    });

  await userRef.update({ referralPending: false });

  return "Referral processed successfully";
};

export const processReferrals = functions.https.onRequest(async (req, res) => {
  try {
    const uid = req.query.uid as string;
    if (!uid) {
      res.status(400).send("Missing uid");
      return;
    }

    const message = await processReferralCore(uid);
    res.send(message);
  } catch (err) {
    console.error("Referral processing error:", err);
    res.status(500).send("Error processing referral");
  }
});

export const processReferralsCallable = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  try {
    const message = await processReferralCore(request.auth.uid);
    return { message };
  } catch (err: any) {
    console.error("Referral processing error (callable):", err);
    throw new HttpsError("internal", "Referral processing failed.");
  }
});

////////////////////////////////////////////////////////////////////////////////
//  GAME OFFER WEBHOOK (BitLabs Games) — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////

export const gameOfferWebhook = onRequest(
  { secrets: [OFFERS_SECRET], region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      const secretFromRequest =
        (req.query.secret as string) ?? (req.body && req.body.secret);
      const expectedSecret = OFFERS_SECRET.value();

      if (!secretFromRequest || secretFromRequest !== expectedSecret) {
        console.warn("Invalid secret on webhook:", secretFromRequest);
        res.status(403).send("Forbidden");
        return;
      }

      const uid =
        (req.query.uid as string) ??
        (req.query.user_id as string) ??
        (req.body && req.body.uid);

      const offerId =
        (req.query.offer_id as string) ?? (req.body && req.body.offer_id);

      const payoutRaw =
        (req.query.payout as string) ??
        (req.query.reward as string) ??
        (req.body && req.body.payout);

      if (!uid || !offerId || !payoutRaw) {
        res.status(400).send("Missing uid / offerId / payout");
        return;
      }

      const basePayout = Number(payoutRaw);
      if (!isFinite(basePayout) || basePayout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);

        const now = admin.firestore.Timestamp.now();
        const serverNow = admin.firestore.FieldValue.serverTimestamp();

        const bonusPercentRaw = userSnap.exists
          ? userSnap.data()?.bonusPercent
          : 0;

        const {
          base,
          baseUserAmount,
          final,
          bonusAmount,
          bonusPercent,
          userPercent,
        } = applyRevenueShare(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "game_offer",
            offerId,
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            at: now,
          }),
        };

        const startedOfferRef = userRef
          .collection("startedOffers")
          .doc(offerId);

        const startedSnap = await tx.get(startedOfferRef);

        if (startedSnap.exists && startedSnap.data()?.status === "completed") {
          return;
        }

        if (!userSnap.exists) {
          tx.set(
            userRef,
            { createdAt: serverNow, ...balanceUpdate },
            { merge: true }
          );
        } else {
          tx.update(userRef, balanceUpdate);
        }

        tx.set(
          startedOfferRef,
          {
            status: "completed",
            completedAt: serverNow,
            lastUpdatedAt: serverNow,
            totalPayout: final,
            title: "Offer",
            type: "game",
          },
          { merge: true }
        );

        tx.set(
          userRef.collection("offers").doc(),
          {
            offerId,
            type: "game",
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            createdAt: serverNow,
          },
          { merge: true }
        );
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("Error in gameOfferWebhook:", err);
      res.status(500).send("Internal error");
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
//  BITLABS SURVEY CALLBACK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////

export const bitlabsSurveyCallback = onRequest(
  { secrets: [OFFERS_SECRET], region: "us-central1", maxInstances: 1 },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      const secretFromRequest =
        (req.query.secret as string) ?? (req.body && req.body.secret);
      const expectedSecret = OFFERS_SECRET.value();

      if (!secretFromRequest || secretFromRequest !== expectedSecret) {
        console.warn(
          "Invalid secret on survey callback:",
          secretFromRequest
        );
        res.status(403).send("Forbidden");
        return;
      }

      const uid =
        (req.query.uid as string) ??
        (req.query.user_id as string) ??
        (req.body && req.body.uid);

      const offerId =
        (req.query.offer_id as string) ?? (req.body && req.body.offer_id);

      const payoutRaw =
        (req.query.payout as string) ??
        (req.query.reward as string) ??
        (req.body && req.body.payout);

      if (!uid || !offerId || !payoutRaw) {
        res.status(400).send("Missing uid / offerId / payout");
        return;
      }

      const basePayout = Number(payoutRaw);
      if (!isFinite(basePayout) || basePayout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);
        const serverNow = admin.firestore.FieldValue.serverTimestamp();
        const now = admin.firestore.Timestamp.now();

        const bonusPercentRaw = userSnap.exists
          ? userSnap.data()?.bonusPercent
          : 0;

        const {
          base,
          baseUserAmount,
          final,
          bonusAmount,
          bonusPercent,
          userPercent,
        } = applyRevenueShare(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "survey",
            offerId,
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            at: now,
          }),
        };

        if (!userSnap.exists) {
          tx.set(
            userRef,
            { createdAt: serverNow, ...balanceUpdate },
            { merge: true }
          );
        } else {
          tx.update(userRef, balanceUpdate);
        }

        tx.set(
          userRef.collection("offers").doc(),
          {
            offerId,
            type: "survey",
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            createdAt: serverNow,
          },
          { merge: true }
        );
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("Error in bitlabsSurveyCallback:", err);
      res.status(500).send("Internal error");
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
//  MAGIC RECEIPTS CALLBACK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////

export const magicReceiptsCallback = onRequest(
  { secrets: [OFFERS_SECRET], region: "us-central1", maxInstances: 1 },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      const secretFromRequest =
        (req.query.secret as string) ?? (req.body && req.body.secret);
      const expectedSecret = OFFERS_SECRET.value();

      if (!secretFromRequest || secretFromRequest !== expectedSecret) {
        console.warn(
          "Invalid secret on magic receipts callback:",
          secretFromRequest
        );
        res.status(403).send("Forbidden");
        return;
      }

      const uid =
        (req.query.uid as string) ??
        (req.query.user_id as string) ??
        (req.body && req.body.uid);

      const receiptId =
        (req.query.receipt_id as string) ??
        (req.body && req.body.receipt_id);

      const payoutRaw =
        (req.query.payout as string) ??
        (req.query.reward as string) ??
        (req.body && req.body.payout);

      const txId =
        (req.query.tx as string) ?? (req.body && req.body.tx);

      if (!uid || !receiptId || !payoutRaw || !txId) {
        res.status(400).send("Missing uid / receiptId / payout / tx");
        return;
      }

      const basePayout = Number(payoutRaw);
      if (!isFinite(basePayout) || basePayout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);

        const now = admin.firestore.Timestamp.now();
        const serverNow = admin.firestore.FieldValue.serverTimestamp();

        const bonusPercentRaw = userSnap.exists
          ? userSnap.data()?.bonusPercent
          : 0;

        const {
          base,
          baseUserAmount,
          final,
          bonusAmount,
          bonusPercent,
          userPercent,
        } = applyRevenueShare(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "magic_receipt",
            receiptId,
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            txId,
            at: now,
          }),
        };

        if (!userSnap.exists) {
          tx.set(
            userRef,
            { createdAt: serverNow, ...balanceUpdate },
            { merge: true }
          );
        } else {
          tx.update(userRef, balanceUpdate);
        }

        tx.set(
          userRef.collection("offers").doc(),
          {
            receiptId,
            type: "magic_receipt",
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            txId,
            createdAt: serverNow,
          },
          { merge: true }
        );
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("Error in magicReceiptsCallback:", err);
      res.status(500).send("Internal error");
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
//  BITLABS RECEIPT CALLBACK — revenue share with streak bonus
////////////////////////////////////////////////////////////////////////////////

export const bitlabsReceiptCallback = onRequest(
  { secrets: [OFFERS_SECRET], region: "us-central1", maxInstances: 1 },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      const secretFromRequest =
        (req.query.secret as string) ?? (req.body && req.body.secret);
      const expectedSecret = OFFERS_SECRET.value();

      if (!secretFromRequest || secretFromRequest !== expectedSecret) {
        console.warn(
          "Invalid secret on receipt callback:",
          secretFromRequest
        );
        res.status(403).send("Forbidden");
        return;
      }

      const uid =
        (req.query.uid as string) ??
        (req.query.user_id as string) ??
        (req.body && req.body.uid);

      const offerId =
        (req.query.offer_id as string) ??
        (req.body && req.body.offer_id);

      const payoutRaw =
        (req.query.payout as string) ??
        (req.query.reward as string) ??
        (req.body && req.body.payout);

      if (!uid || !offerId || !payoutRaw) {
        res.status(400).send("Missing uid / offerId / payout");
        return;
      }

      const basePayout = Number(payoutRaw);
      if (!isFinite(basePayout) || basePayout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);

        const serverNow = admin.firestore.FieldValue.serverTimestamp();
        const now = admin.firestore.Timestamp.now();

        const bonusPercentRaw = userSnap.exists
          ? userSnap.data()?.bonusPercent
          : 0;

        const {
          base,
          baseUserAmount,
          final,
          bonusAmount,
          bonusPercent,
          userPercent,
        } = applyRevenueShare(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "magic_receipt",
            offerId,
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            at: now,
          }),
        };

        if (!userSnap.exists) {
          tx.set(
            userRef,
            { createdAt: serverNow, ...balanceUpdate },
            { merge: true }
          );
        } else {
          tx.update(userRef, balanceUpdate);
        }

        tx.set(
          userRef.collection("offers").doc(),
          {
            offerId,
            type: "magic_receipt",
            amount: final,
            baseAmount: base,
            userBaseAmount: baseUserAmount,
            bonusAmount,
            bonusPercent,
            userPercent,
            createdAt: serverNow,
          },
          { merge: true }
        );
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("Error in bitlabsReceiptCallback:", err);
      res.status(500).send("Internal error");
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
//  SHORTCUT BONUS (PWA install / standalone launch)
////////////////////////////////////////////////////////////////////////////////

const SHORTCUT_BONUS_AMOUNT = 0.05;
const SHORTCUT_BONUS_ID = "shortcut_bonus";

export const claimShortcutBonus = functions.https.onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const userRef = db.collection("users").doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      throw new HttpsError("failed-precondition", "User not found.");
    }

    const data = snap.data() || {};
    const alreadyClaimed = data.shortcutBonusClaimed === true;

    if (alreadyClaimed) {
      throw new HttpsError(
        "failed-precondition",
        "Shortcut bonus already claimed."
      );
    }

    const now = admin.firestore.Timestamp.now();
    const serverNow = admin.firestore.FieldValue.serverTimestamp();
    const startedOfferRef = userRef
      .collection("startedOffers")
      .doc(SHORTCUT_BONUS_ID);

    tx.update(userRef, {
      balance: admin.firestore.FieldValue.increment(SHORTCUT_BONUS_AMOUNT),
      shortcutBonusClaimed: true,
      shortcutBonusAt: serverNow,
      shortcutBonusToken: null,
      auditLog: admin.firestore.FieldValue.arrayUnion({
        type: "shortcut_bonus",
        amount: SHORTCUT_BONUS_AMOUNT,
        at: now,
      }),
    });

    tx.set(
      startedOfferRef,
      {
        status: "completed",
        completedAt: serverNow,
        lastUpdatedAt: serverNow,
        totalPayout: SHORTCUT_BONUS_AMOUNT,
        title: "Home screen bonus",
        type: "bonus",
        source: "pwa_shortcut",
      },
      { merge: true }
    );

    tx.set(
      userRef.collection("offers").doc(),
      {
        offerId: SHORTCUT_BONUS_ID,
        type: "bonus",
        amount: SHORTCUT_BONUS_AMOUNT,
        source: "pwa_shortcut",
        createdAt: serverNow,
      },
      { merge: true }
    );

    return { ok: true, amount: SHORTCUT_BONUS_AMOUNT };
  });
});

////////////////////////////////////////////////////////////////////////////////
//  DAILY CHECK-IN — callable function (server-only streak update)
////////////////////////////////////////////////////////////////////////////////

export const dailyCheckIn = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to check in."
    );
  }

  const uid = request.auth.uid;
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();

  const now = admin.firestore.Timestamp.now();
  const nowDate = now.toDate();

  let dailyStreak = 0;
  let bonusPercent = 0;
  let lastCheckIn: admin.firestore.Timestamp | null = null;

  if (snap.exists) {
    const data = snap.data() || {};
    dailyStreak = typeof data.dailyStreak === "number" ? data.dailyStreak : 0;
    bonusPercent =
      typeof data.bonusPercent === "number" ? data.bonusPercent : 0;
    lastCheckIn = data.lastCheckIn || null;
  }

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let updated = false;
  let reset = false;

  if (!lastCheckIn) {
    // first ever check-in
    dailyStreak = 1;
    bonusPercent = 0.5;
    updated = true;
  } else {
    const lastDate = lastCheckIn.toDate();
    const diffMs = nowDate.getTime() - lastDate.getTime();
    const diffDays = diffMs / ONE_DAY_MS;

    if (diffDays < 0.75) {
      // already checked in "today" (within ~18h window)
      updated = false;
    } else if (diffDays < 1.75) {
      // next day: increment
      dailyStreak = dailyStreak + 1;
      bonusPercent = clampBonusPercent(bonusPercent + 0.5);
      updated = true;
    } else {
      // missed too long: reset
      dailyStreak = 1;
      bonusPercent = 0.5;
      reset = true;
      updated = true;
    }
  }

  if (updated) {
    await userRef.set(
      {
        dailyStreak,
        bonusPercent,
        lastCheckIn: now,
      },
      { merge: true }
    );
  }

  return {
    updated,
    reset,
    dailyStreak,
    bonusPercent,
    lastCheckIn: now.toMillis(),
  };
});

////////////////////////////////////////////////////////////////////////////////
//  CLEANUP — 24H startedOffers cleanup (unchanged)
////////////////////////////////////////////////////////////////////////////////

export const cleanupCompletedOffers = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();

  const cutoff = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );

  console.log("Starting cleanupCompletedOffers, cutoff:", cutoff.toDate());

  const usersSnap = await db.collection("users").get();

  const batchSize = 400;
  let batch = db.batch();
  let writeCount = 0;
  const commits: Promise<FirebaseFirestore.WriteResult[]>[] = [];

  for (const userDoc of usersSnap.docs) {
    const startedRef = userDoc.ref.collection("startedOffers");

    const completedSnap = await startedRef
      .where("status", "==", "completed")
      .where("completedAt", "<", cutoff)
      .get();

    if (completedSnap.empty) continue;

    completedSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      writeCount++;

      if (writeCount >= batchSize) {
        commits.push(batch.commit());
        batch = db.batch();
        writeCount = 0;
      }
    });
  }

  if (writeCount > 0) commits.push(batch.commit());

  await Promise.all(commits);

  console.log("cleanupCompletedOffers finished.");
});

// ============================================================
// BREADGAME CONSTANTS
// ============================================================
const BREADGAME_CRUMBS_PER_PACKAGE = 50_000; // crumbs → 1¢ package
const BREADGAME_PACKAGE_REWARD_CENTS = 1; // 1 cent
const BREADGAME_DAILY_CAP_CENTS = 10; // 10¢ per day max
const BREADGAME_MAX_PACKAGES_PER_DAY =
  BREADGAME_DAILY_CAP_CENTS / BREADGAME_PACKAGE_REWARD_CENTS;
const BREADGAME_COOLDOWN_SECONDS = 60 * 60; // 1 hour between packages

////////////////////////////////////////////////////////////////////////////////
//  BREADGAME — secure 1¢ package purchase
//  - Enforces crumbs cost
//  - Enforces 1hr cooldown
//  - Enforces 10¢ per day max
//  - Credits user.balance by $0.01
////////////////////////////////////////////////////////////////////////////////

export const breadgameBuyPackage = functions.https.onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;

  return db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(uid);
    const stateRef = userRef.collection("breadgame").doc("state");

    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "User record not found for breadgame."
      );
    }

    const stateSnap = await tx.get(stateRef);
    const data = stateSnap.exists ? stateSnap.data() || {} : {};

    const crumbs =
      typeof data.crumbs === "number" && isFinite(data.crumbs)
        ? data.crumbs
        : 0;
    const packagesBoughtToday =
      typeof data.packagesBoughtToday === "number" &&
      isFinite(data.packagesBoughtToday)
        ? data.packagesBoughtToday
        : 0;
    const todayCents =
      typeof data.todayCents === "number" && isFinite(data.todayCents)
        ? data.todayCents
        : 0;

    const lastPackageAtTs = data.lastPackageAt as
      | admin.firestore.Timestamp
      | undefined;

    // Daily cap enforcement (max 10¢ or 10 packages)
    if (
      packagesBoughtToday >= BREADGAME_MAX_PACKAGES_PER_DAY ||
      todayCents >= BREADGAME_DAILY_CAP_CENTS
    ) {
      throw new HttpsError(
        "resource-exhausted",
        "Daily breadgame limit reached."
      );
    }

    // Must have enough crumbs
    if (crumbs < BREADGAME_CRUMBS_PER_PACKAGE) {
      throw new HttpsError(
        "failed-precondition",
        "Not enough crumbs for a package."
      );
    }

    // Cooldown enforcement: 1 hour between packages
    const nowMs = Date.now();
    if (lastPackageAtTs) {
      const lastMs = lastPackageAtTs.toMillis();
      const nextAllowed = lastMs + BREADGAME_COOLDOWN_SECONDS * 1000;
      if (nowMs < nextAllowed) {
        const remainingMs = nextAllowed - nowMs;
        throw new HttpsError(
          "failed-precondition",
          `Package on cooldown. Try again in ${Math.ceil(
            remainingMs / 1000
          )} seconds.`
        );
      }
    }

    const newCrumbs = crumbs - BREADGAME_CRUMBS_PER_PACKAGE;
    const newPackages = packagesBoughtToday + 1;
    const newTodayCents = todayCents + BREADGAME_PACKAGE_REWARD_CENTS;
    const nowTs = admin.firestore.Timestamp.now();

    // Update breadgame state
    tx.set(
      stateRef,
      {
        crumbs: newCrumbs,
        packagesBoughtToday: newPackages,
        todayCents: newTodayCents,
        lastPackageAt: nowTs,
      },
      { merge: true }
    );

    // Credit main user balance in DOLLARS
    const rewardDollars = BREADGAME_PACKAGE_REWARD_CENTS / 100;

    tx.update(userRef, {
      balance: admin.firestore.FieldValue.increment(rewardDollars),
      auditLog: admin.firestore.FieldValue.arrayUnion({
        type: "breadgame_package",
        amount: rewardDollars,
        crumbsSpent: BREADGAME_CRUMBS_PER_PACKAGE,
        at: nowTs,
      }),
    });

    return {
      ok: true,
      crumbs: newCrumbs,
      packagesBoughtToday: newPackages,
      todayCents: newTodayCents,
      lastPackageAt: nowTs.toMillis(),
    };
  });
});

////////////////////////////////////////////////////////////////////////////////
//  BREADGAME DAILY RESET — 12am EST
//  - Resets crumbs & upgrades & daily counters
//  - Keeps cosmetics
////////////////////////////////////////////////////////////////////////////////

export const resetBreadgameDaily = onSchedule(
  {
    schedule: "0 0 * * *", // every day at 00:00
    timeZone: "America/New_York", // 12am EST
  },
  async (event) => {
    console.log("Starting resetBreadgameDaily for breadgame state…");

    const usersSnap = await db.collection("users").get();

    const batchSize = 400;
    let batch = db.batch();
    let writeCount = 0;
    const commits: Promise<FirebaseFirestore.WriteResult[]>[] = [];

    for (const userDoc of usersSnap.docs) {
      const stateRef = userDoc.ref.collection("breadgame").doc("state");
      const stateSnap = await stateRef.get();

      if (!stateSnap.exists) continue;

      const data = stateSnap.data() || {};
      const cosmetics = data.cosmetics || {};

      batch.set(
        stateRef,
        {
          crumbs: 0,
          clickPowerLevel: 0,
          autoClickLevel: 0,
          packagesBoughtToday: 0,
          todayCents: 0,
          lastPackageAt: null,
          cosmetics,
          lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      writeCount++;
      if (writeCount >= batchSize) {
        commits.push(batch.commit());
        batch = db.batch();
        writeCount = 0;
      }
    }

    if (writeCount > 0) commits.push(batch.commit());

    await Promise.all(commits);

    console.log("resetBreadgameDaily finished.");
  }
);

export { cpxPostback } from "./cpxPostback";

////////////////////////////////////////////////////////////////////////////////
//  PAYOUT MIRRORING (cashout & donation -> user/{uid}/payouts)
////////////////////////////////////////////////////////////////////////////////

const writeUserPayout = async (
  userId: string,
  payoutId: string,
  data: Record<string, any>
) => {
  const ref = db.collection("users").doc(userId).collection("payouts").doc(payoutId);
  await ref.set(
    {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

const sendTelegramMessage = async (text: string) => {
  const token = TELEGRAM_BOT_TOKEN.value();
  const chatId = TELEGRAM_CHAT_ID.value();
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("Telegram notify failed:", err);
  }
};

const sendEmail = async (to: string, subject: string, text: string) => {
  const apiKey = SENDGRID_API_KEY.value();
  const fromEmail = SENDGRID_FROM_EMAIL.value();
  if (!apiKey || !fromEmail || !to) return;

  try {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: "ReadyBread" },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
  } catch (err) {
    console.error("SendGrid email failed:", err);
  }
};

export const mirrorCashoutToUser = onDocumentWritten(
  {
    document: "cashout_requests/{id}",
    secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.data()) return;
    const data = after.data() as any;
    const prev = event.data?.before?.data() as any;
    const userId = data.userId as string | undefined;
    if (!userId) return;

    const payoutId = event.params.id as string;
    const amount = Number(data.amount) || 0;
    const status = typeof data.status === "string" ? data.status : "pending";
    const method = typeof data.method === "string" ? data.method : "cashout";
    const notes =
      (typeof data.denialReason === "string" && data.denialReason) ||
      (typeof data.notes === "string" && data.notes) ||
      null;
    const createdAt = data.createdAt || admin.firestore.FieldValue.serverTimestamp();

    await writeUserPayout(userId, payoutId, {
      type: "cashout",
      amount,
      status,
      method,
      notes,
      createdAt,
      decidedAt: data.decidedAt || admin.firestore.FieldValue.serverTimestamp(),
      adminUid: data.adminUid || null,
      refunded: Boolean(data.refunded),
      cryptoFee:
        typeof data.cryptoFee === "number" && isFinite(data.cryptoFee)
          ? data.cryptoFee
          : null,
    });

    // Notify admin channel when a new request is created
    if (!prev && status === "pending") {
      const dest =
        data.paypalEmail ||
        data.cashappTag ||
        data.venmoUsername ||
        data.bitcoinAddress ||
        method;
      await sendTelegramMessage(
        `New cashout request:\n• User: ${userId}\n• Amount: $${amount.toFixed(
          2
        )}\n• Method: ${method}\n• Destination: ${dest || "N/A"}`
      );
    }

    // Email user on status change to fulfilled/denied
    const prevStatus = prev ? (prev.status as string) : null;
    const statusChanged =
      prevStatus && prevStatus !== status && (status === "fulfilled" || status === "denied");

    if (statusChanged) {
      try {
        const userSnap = await db.collection("users").doc(userId).get();
        const userEmail =
          (userSnap.exists && (userSnap.data() as any)?.email) ||
          (typeof data.paypalEmail === "string" ? data.paypalEmail : null);

        if (userEmail) {
          const destination =
            data.paypalEmail ||
            data.cashappTag ||
            data.venmoUsername ||
            data.bitcoinAddress ||
            method;
          const noteText = notes ? `\nNotes: ${notes}` : "";
          const subject =
            status === "fulfilled"
              ? "Your ReadyBread cashout was approved"
              : "Your ReadyBread cashout was denied";
          const body =
            `Hi there,\n\nYour cashout request has been ${status}.\n\n` +
            `Amount: $${amount.toFixed(2)}\n` +
            `Method: ${method}\n` +
            `Destination: ${destination || "N/A"}${noteText}\n\n` +
            `If you have questions, reply to this email.\n\nThanks,\nReadyBread`;

          await sendEmail(userEmail, subject, body);
        }
      } catch (err) {
        console.error("Failed to send cashout email:", err);
      }
    }
  }
);

export const mirrorDonationToUser = onDocumentWritten(
  {
    document: "donation_requests/{id}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.data()) return;
    const data = after.data() as any;
    const prev = event.data?.before?.data() as any;
    const userId = data.userId as string | undefined;
    if (!userId) return;

    const payoutId = event.params.id as string;
    const amount = Number(data.amount) || 0;
    const status = typeof data.status === "string" ? data.status : "pending";
    const method =
      (typeof data.charityName === "string" && data.charityName) || "Donation";
    const notes =
      (typeof data.denialReason === "string" && data.denialReason) ||
      (typeof data.notes === "string" && data.notes) ||
      null;
    const createdAt = data.createdAt || admin.firestore.FieldValue.serverTimestamp();

    await writeUserPayout(userId, payoutId, {
      type: "donation",
      amount,
      status,
      method,
      notes,
      createdAt,
      decidedAt: data.decidedAt || admin.firestore.FieldValue.serverTimestamp(),
      adminUid: data.adminUid || null,
      refunded: Boolean(data.refunded),
    });

    const prevStatus = prev ? (prev.status as string) : null;
    const statusChanged =
      prevStatus && prevStatus !== status && (status === "fulfilled" || status === "denied");

    if (statusChanged) {
      try {
        const userSnap = await db.collection("users").doc(userId).get();
        const userEmail =
          (userSnap.exists && (userSnap.data() as any)?.email) ||
          (typeof data.receiptEmail === "string" ? data.receiptEmail : null);

        if (userEmail) {
          const noteText = notes ? `\nNotes: ${notes}` : "";
          const subject =
            status === "fulfilled"
              ? "Your ReadyBread donation was processed"
              : "Your ReadyBread donation was denied";
          const body =
            `Hi there,\n\nYour donation request has been ${status}.\n\n` +
            `Amount: $${amount.toFixed(2)}\n` +
            `Charity: ${method}${noteText}\n\n` +
            `If you have questions, reply to this email.\n\nThanks,\nReadyBread`;

          await sendEmail(userEmail, subject, body);
        }
      } catch (err) {
        console.error("Failed to send donation email:", err);
      }
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
//  QUEST REWARDS (ReadyBread Quests) - callable
//  - Awards cash for daily/weekly/general quests
//  - Idempotent per quest + window (EST)
////////////////////////////////////////////////////////////////////////////////

type QuestScope = "daily" | "weekly" | "general";

const QUEST_REWARDS: Record<
  string,
  { cash: number; scope: QuestScope }
> = {
  "daily-survey": { cash: 0.01, scope: "daily" },
  "daily-game": { cash: 0.01, scope: "daily" },
  "week-surveys": { cash: 0.05, scope: "weekly" },
  "week-games": { cash: 0.05, scope: "weekly" },
  "week-referral": { cash: 0.05, scope: "weekly" },
  "home-screen": { cash: 0.05, scope: "general" }, // aligns with shortcut bonus
  "email-verified": { cash: 0.01, scope: "general" },
  "first-offer": { cash: 0.02, scope: "general" },
  "first-survey": { cash: 0.01, scope: "general" },
};

const getEasternOffsetMinutes = (): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "longOffset",
    hour12: false,
  }).formatToParts(new Date());

  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-05:00";
  const match = tz.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return -300;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3] || "0", 10);

  return sign * (hours * 60 + minutes);
};

const getQuestWindowStart = (scope: QuestScope): number => {
  if (scope === "general") return 0;

  const offsetMinutes = getEasternOffsetMinutes();
  const offsetMs = offsetMinutes * 60 * 1000;
  const now = Date.now();
  const estNow = new Date(now + offsetMs);

  const startOfDayEst = new Date(estNow);
  startOfDayEst.setHours(0, 0, 0, 0);

  if (scope === "daily") {
    return startOfDayEst.getTime() - offsetMs;
  }

  // weekly (Monday start)
  const startOfWeekEst = new Date(startOfDayEst);
  const day = startOfDayEst.getDay(); // 0 = Sun, 1 = Mon
  const daysSinceMonday = (day + 6) % 7;
  startOfWeekEst.setDate(startOfWeekEst.getDate() - daysSinceMonday);

  return startOfWeekEst.getTime() - offsetMs;
};

export const claimQuestReward = functions.https.onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const questId = (request.data?.questId || "").toString();

  const quest = QUEST_REWARDS[questId];
  if (!quest) {
    throw new HttpsError("invalid-argument", "Unknown quest.");
  }

  const windowStart = getQuestWindowStart(quest.scope);
  const claimKey = `${questId}-${windowStart}`;
  const now = admin.firestore.Timestamp.now();
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  const userRef = db.collection("users").doc(uid);
  const claimRef = userRef.collection("questClaims").doc(claimKey);
  const offerRef = userRef.collection("offers").doc();

  return db.runTransaction(async (tx) => {
    const [userSnap, claimSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(claimRef),
    ]);

    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "User not found.");
    }

    if (claimSnap.exists) {
      return { ok: true, alreadyClaimed: true, cash: quest.cash };
    }

    if (quest.cash > 0) {
      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(quest.cash),
        auditLog: admin.firestore.FieldValue.arrayUnion({
          type: "quest",
          questId,
          amount: quest.cash,
          at: now,
        }),
      });
    }

    tx.set(
      claimRef,
      {
        questId,
        scope: quest.scope,
        windowStart,
        cash: quest.cash,
        createdAt: serverNow,
      },
      { merge: true }
    );

    tx.set(
      offerRef,
      {
        offerId: questId,
        type: "quest",
        source: "Readybread Quests",
        amount: quest.cash,
        createdAt: serverNow,
      },
      { merge: true }
    );

    return { ok: true, cash: quest.cash };
  });
});
