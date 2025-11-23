import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

// SECRETS
const OFFERS_SECRET = defineSecret("OFFERS_SECRET");

// Referral constants
const REFERRAL_REWARD = 0.25;
const REFERRAL_CAP = 1.0;

/* ============================================================
   REFERRALS — /processReferrals
============================================================ */
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

    // Record under referred user
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

    // PAY referrer
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

/* ============================================================
   GAME / SURVEY / RECEIPT OFFERS — /gameOfferWebhook
============================================================ */
export const gameOfferWebhook = onRequest(
  { secrets: [OFFERS_SECRET], region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      // Get secret sent from offerwall
      const secretFromRequest =
        (req.query.secret as string) ??
        (req.body && req.body.secret);

      const expectedSecret = OFFERS_SECRET.value();

      if (!secretFromRequest || secretFromRequest !== expectedSecret) {
        console.warn("Invalid secret on webhook:", secretFromRequest);
        res.status(403).send("Forbidden");
        return;
      }

      // Parameters
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

      const payout = Number(payoutRaw);
      if (!isFinite(payout) || payout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);

        const serverNow = admin.firestore.FieldValue.serverTimestamp();
        const now = admin.firestore.Timestamp.now();

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(payout),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "game_offer",
            offerId,
            amount: payout,
            at: now,
          }),
        };

        const startedOfferRef = userRef
          .collection("startedOffers")
          .doc(offerId);

        const startedSnap = await tx.get(startedOfferRef);

        // Already completed?
        if (startedSnap.exists && startedSnap.data()?.status === "completed") {
          console.log("Already completed, skip:", uid, offerId);
          return;
        }

        if (!userSnap.exists) {
          tx.set(
            userRef,
            {
              createdAt: serverNow,
              ...balanceUpdate,
            },
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
            totalPayout: payout,
            title: "Offer",
            type: "game",
          },
          { merge: true }
        );

        tx.set(userRef.collection("offers").doc(), {
          offerId,
          type: "game",
          amount: payout,
          createdAt: serverNow,
        });
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("Error in gameOfferWebhook:", err);
      res.status(500).send("Internal error");
    }
  }
);

/* ============================================================
   BITLABS SURVEY CALLBACK — /bitlabsSurveyCallback
   Expects: secret, uid, offer_id, payout (USD)
============================================================ */
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

      const payout = Number(payoutRaw);
      if (!isFinite(payout) || payout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);
        const serverNow = admin.firestore.FieldValue.serverTimestamp();
        const now = admin.firestore.Timestamp.now();

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(payout),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "survey",
            offerId,
            amount: payout,
            at: now,
          }),
        };

        if (!userSnap.exists) {
          tx.set(
            userRef,
            {
              createdAt: serverNow,
              ...balanceUpdate,
            },
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
            amount: payout,
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
/* ============================================================
   MAGIC RECEIPTS CALLBACK — /magicReceiptsCallback
   Expects: secret, uid, receipt_id, payout, tx
============================================================ */
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

      // Pull fields
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

      const payout = Number(payoutRaw);
      if (!isFinite(payout) || payout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);

        const now = admin.firestore.Timestamp.now();
        const serverNow = admin.firestore.FieldValue.serverTimestamp();

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(payout),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "magic_receipt",
            receiptId,
            amount: payout,
            txId,
            at: now,
          }),
        };

        // Create or update user doc
        if (!userSnap.exists) {
          tx.set(
            userRef,
            {
              createdAt: serverNow,
              ...balanceUpdate,
            },
            { merge: true }
          );
        } else {
          tx.update(userRef, balanceUpdate);
        }

        // Save to history
        tx.set(
          userRef.collection("offers").doc(),
          {
            receiptId,
            type: "magic_receipt",
            amount: payout,
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

/* ============================================================
   MAGIC RECEIPTS CALLBACK — /bitlabsReceiptCallback
   Expects: secret, uid, offer_id, payout, tx
============================================================ */
export const bitlabsReceiptCallback = onRequest(
  { secrets: [OFFERS_SECRET], region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }

      // Validate secret
      const secretFromRequest =
        (req.query.secret as string) ?? (req.body && req.body.secret);

      const expectedSecret = OFFERS_SECRET.value();

      if (!secretFromRequest || secretFromRequest !== expectedSecret) {
        console.warn("Invalid secret on receipt callback:", secretFromRequest);
        res.status(403).send("Forbidden");
        return;
      }

      // Parameters
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

      const payout = Number(payoutRaw);
      if (!isFinite(payout) || payout <= 0) {
        res.status(400).send("Invalid payout");
        return;
      }

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);

        const serverNow = admin.firestore.FieldValue.serverTimestamp();
        const now = admin.firestore.Timestamp.now();

        const balanceUpdate = {
          balance: admin.firestore.FieldValue.increment(payout),
          auditLog: admin.firestore.FieldValue.arrayUnion({
            type: "magic_receipt",
            offerId,
            amount: payout,
            at: now,
          }),
        };

        // Create user doc if for some reason missing
        if (!userSnap.exists) {
          tx.set(
            userRef,
            {
              createdAt: serverNow,
              ...balanceUpdate,
            },
            { merge: true }
          );
        } else {
          tx.update(userRef, balanceUpdate);
        }

        // Save receipt transaction in offers history
        tx.set(
          userRef.collection("offers").doc(),
          {
            offerId,
            type: "magic_receipt",
            amount: payout,
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

// Clean up completed startedOffers after ~24 hours
export const cleanupCompletedOffers = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();

  // Anything completed more than 24h ago
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

    // Only completed offers older than 24h
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

  if (writeCount > 0) {
    commits.push(batch.commit());
  }

  await Promise.all(commits);

  console.log("cleanupCompletedOffers finished.");
});
