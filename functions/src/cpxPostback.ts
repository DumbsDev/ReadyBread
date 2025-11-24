// functions/src/cpxPostback.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const CPX_SECRET = "OIN98MFDSLNFDS80IJF"; // your CPX shared secret

export const cpxPostback = functions.https.onRequest(async (req, res): Promise<void> => {
  try {
    const {
      user_id,
      amount_usd,
      amount_local,
      trans_id,
      status,
      offer_id,
      hash,
    } = req.query;

    // -------------------------------
    // REQUIRED PARAM CHECK
    // -------------------------------
    if (!user_id || !amount_usd || !trans_id || !status) {
      res.status(400).send("Missing required params");
      return;
    }

    // -------------------------------
    // HASH VALIDATION
    // -------------------------------
    if (hash !== CPX_SECRET) {
      res.status(403).send("Invalid hash");
      return;
    }

    const rawAmount = parseFloat(amount_usd as string);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      res.status(400).send("Invalid amount");
      return;
    }

    const uid = String(user_id);
    const userRef = admin.firestore().collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(404).send("User not found");
      return;
    }

    // -------------------------------
    // DUPLICATE PREVENTION
    // -------------------------------
    const txRef = admin.firestore().collection("completedOffers").doc(String(trans_id));
    const txSnap = await txRef.get();

    if (txSnap.exists) {
      res.status(200).send("OK (duplicate ignored)");
      return;
    }

    // -------------------------------
    // 50% SPLIT
    // -------------------------------
    const platformCut = rawAmount * 0.5;
    const userEarn = rawAmount * 0.5;

    // -------------------------------
    // FRAUD / REVERSAL CASE
    // status 2 = reversal
    // -------------------------------
    if (String(status) === "2") {
      await userRef.update({
        balance: admin.firestore.FieldValue.increment(-userEarn), // reverse ONLY user payout
      });

      await txRef.set({
        uid,
        type: "cpx",
        offerId: offer_id || null,
        reversed: true,
        reversalAmount: userEarn,
        originalGross: rawAmount,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).send("Reversal OK");
      return;
    }

    // -------------------------------
    // NORMAL CREDIT (with streak bonus)
    // -------------------------------
    await admin.firestore().runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      const data = userDoc.data() || {};

      const bonusPercent = typeof data.bonusPercent === "number" ? data.bonusPercent : 0;
      const streakMultiplier = 1 + bonusPercent / 100;

      const finalPayout = userEarn * streakMultiplier;
      const bonusAmount = finalPayout - userEarn;

      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(finalPayout),
        auditLog: admin.firestore.FieldValue.arrayUnion({
          type: "cpx",
          offerId: offer_id || null,
          transactionId: trans_id,
          gross: rawAmount,
          userEarn,
          platformCut,
          bonusPercent,
          bonusAmount,
          creditedFinal: finalPayout,
          at: admin.firestore.Timestamp.now(),
        }),
      });

      // store completed offer globally
      tx.set(txRef, {
        uid,
        offerId: offer_id || null,
        source: "cpx",
        gross: rawAmount,
        userEarn,
        platformCut,
        bonusPercent,
        bonusAmount,
        creditedFinal: finalPayout,
        trans_id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Optional: store inside /users/{uid}/offers
      tx.set(
        userRef.collection("offers").doc(),
        {
          offerId: offer_id || null,
          type: "cpx",
          amount: finalPayout,
          gross: rawAmount,
          userEarn,
          platformCut,
          bonusAmount,
          bonusPercent,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      );
    });

    res.status(200).send("OK");
  } catch (err) {
    console.error("CPX ERROR:", err);
    res.status(500).send("Server error");
  }
});
