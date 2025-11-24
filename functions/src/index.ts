import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

/* ============================================================
   STREAK BONUS HELPERS
============================================================ */

function clampBonusPercent(raw: any): number {
  if (typeof raw !== "number" || !isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > 10) return 10; // cap streak bonus at +10%
  return raw;
}

// basePayout (from partner) * (1 + bonusPercent/100)
function applyStreakBonus(basePayout: number, bonusPercentRaw: any) {
  const bonusPercent = clampBonusPercent(bonusPercentRaw);
  const multiplier = 1 + bonusPercent / 100;

  const finalRaw = basePayout * multiplier;
  const final = Math.round(finalRaw * 100) / 100; // round to cents
  const bonusAmount = Math.max(0, final - basePayout);

  return {
    base: basePayout,
    bonusPercent,
    final,
    bonusAmount,
  };
}

/* ============================================================
   SECRETS
============================================================ */
const OFFERS_SECRET = defineSecret("OFFERS_SECRET");

////////////////////////////////////////////////////////////////////////////////
//  ADGEM WEBHOOK — with streak bonus
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
        (req.query.secret as string) ??
        (req.body && req.body.secret);
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
        (req.query.offer_id as string) ??
        (req.body && req.body.offer_id);

      const amountRaw =
        (req.query.amount as string) ??
        (req.body && req.body.amount);

      const txId =
        (req.query.transaction_id as string) ??
        (req.body && req.body.transaction_id);

      if (!uid || !offerId || !amountRaw || !txId) {
        res.status(400).send("Missing uid / offerId / amount / transaction_id");
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

        const bonusPercentRaw = userSnap.exists ? userSnap.data()?.bonusPercent : 0;
        const { final, base, bonusAmount, bonusPercent } =
          applyStreakBonus(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "adgem",
            offerId,
            amount: final,
            baseAmount: base,
            bonusAmount,
            bonusPercent,
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
            bonusAmount,
            bonusPercent,
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
          bonusAmount,
          bonusPercent,
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
//  REFERRALS — unchanged
////////////////////////////////////////////////////////////////////////////////

const REFERRAL_REWARD = 0.25;
const REFERRAL_CAP = 1.0;

export const processReferrals = functions.https.onRequest(async (req, res) => {
  try {
    const uid = req.query.uid as string;
    if (!uid) {
      res.status(400).send("Missing uid");
      return;
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(404).send("User not found");
      return;
    }

    const user = userSnap.data()!;
    const referredBy = user.referredBy || null;

    if (!referredBy) {
      res.send("No referral code used");
      return;
    }

    if (!user.referralPending) {
      res.send("Referral already resolved");
      return;
    }

    const fbUser = await admin.auth().getUser(uid);
    if (!fbUser.emailVerified) {
      res.send("Email not verified – cannot process referral yet");
      return;
    }

    const refQ = await db
      .collection("users")
      .where("referralCode", "==", referredBy)
      .limit(1)
      .get();

    if (refQ.empty) {
      await userRef.update({ referralPending: false });
      res.send("Invalid referral code");
      return;
    }

    const referrerDoc = refQ.docs[0];
    const referrerId = referrerDoc.id;
    const referrer = referrerDoc.data()!;

    if (referrerId === uid) {
      await userRef.update({ referralPending: false });
      res.send("Self referral blocked");
      return;
    }

    if (referrer.referredBy === user.referralCode) {
      await userRef.update({ referralPending: false });
      res.send("Circular referral blocked");
      return;
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
      res.send("Same-device referral — referrer not paid");
      return;
    }

    const currentEarned = referrer.totalReferralEarnings || 0;
    if (currentEarned >= REFERRAL_CAP) {
      await userRef.update({ referralPending: false });
      res.send("Referrer at cap");
      return;
    }

    await db.collection("users").doc(referrerId).update({
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

    res.send("Referral processed successfully");
  } catch (err) {
    console.error("Referral processing error:", err);
    res.status(500).send("Error processing referral");
  }
});

////////////////////////////////////////////////////////////////////////////////
//  GAME OFFER WEBHOOK (BitLabs Games) — with streak bonus
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
        (req.query.secret as string) ??
        (req.body && req.body.secret);
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

        const now = admin.firestore.Timestamp.now();
        const serverNow = admin.firestore.FieldValue.serverTimestamp();

        const bonusPercentRaw = userSnap.exists ? userSnap.data()?.bonusPercent : 0;
        const { final, base, bonusAmount, bonusPercent } =
          applyStreakBonus(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "game_offer",
            offerId,
            amount: final,
            baseAmount: base,
            bonusAmount,
            bonusPercent,
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
            bonusAmount,
            bonusPercent,
            createdAt: serverNow,
          }
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
//  BITLABS SURVEY CALLBACK — with streak bonus
////////////////////////////////////////////////////////////////////////////////

export const bitlabsSurveyCallback = onRequest(
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
        console.warn("Invalid secret on survey callback:", secretFromRequest);
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

        const bonusPercentRaw = userSnap.exists ? userSnap.data()?.bonusPercent : 0;
        const { final, base, bonusAmount, bonusPercent } =
          applyStreakBonus(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "survey",
            offerId,
            amount: final,
            baseAmount: base,
            bonusAmount,
            bonusPercent,
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
            bonusAmount,
            bonusPercent,
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
//  MAGIC RECEIPTS CALLBACK — with streak bonus
////////////////////////////////////////////////////////////////////////////////

export const magicReceiptsCallback = onRequest(
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
        console.warn("Invalid secret on magic receipts callback:", secretFromRequest);
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
        (req.query.tx as string) ??
        (req.body && req.body.tx);

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

        const bonusPercentRaw = userSnap.exists ? userSnap.data()?.bonusPercent : 0;
        const { final, base, bonusAmount, bonusPercent } =
          applyStreakBonus(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "magic_receipt",
            receiptId,
            amount: final,
            baseAmount: base,
            bonusAmount,
            bonusPercent,
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
            bonusAmount,
            bonusPercent,
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
//  BITLABS RECEIPT CALLBACK — with streak bonus
////////////////////////////////////////////////////////////////////////////////

export const bitlabsReceiptCallback = onRequest(
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
        console.warn("Invalid secret on receipt callback:", secretFromRequest);
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

        const bonusPercentRaw = userSnap.exists ? userSnap.data()?.bonusPercent : 0;
        const { final, base, bonusAmount, bonusPercent } =
          applyStreakBonus(basePayout, bonusPercentRaw);

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(final),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "magic_receipt",
            offerId,
            amount: final,
            baseAmount: base,
            bonusAmount,
            bonusPercent,
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
            bonusAmount,
            bonusPercent,
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
    bonusPercent = typeof data.bonusPercent === "number" ? data.bonusPercent : 0;
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

export { cpxPostback } from "./cpxPostback";
