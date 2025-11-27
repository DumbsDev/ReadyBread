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
      goal_id,
      g,               // some CPX setups use "g" for goal
      et,              // event type / progression event
      event_id,        // some networks send event progress
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

    // -------------------------------
    // USER + UNIQUE TX ID
    // -------------------------------
    const uid = String(user_id);

    // HANDLE GOALS SAFELY
    let txId = String(trans_id);

    const goalValue = goal_id || g || et || event_id || null;
    if (goalValue) {
      txId = `${txId}_goal_${goalValue}`;
    }

    const userRef = admin.firestore().collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(404).send("User not found");
      return;
    }

    // -------------------------------
    // DUPLICATE PREVENTION
    // -------------------------------
    const txRef = admin.firestore()
      .collection("completedOffers")
      .doc(String(txId));

    const txSnap = await txRef.get();
    if (txSnap.exists) {
      res.status(200).send("OK (duplicate ignored)");
      return;
    }

    // -------------------------------
    // REVERSAL CASE
    // status 2 = reversed / fraud
    // -------------------------------
    if (String(status) === "2") {
      const reversalAmount = rawAmount * 0.5; // reverse only user share

      await userRef.update({
        balance: admin.firestore.FieldValue.increment(-reversalAmount),
        auditLog: admin.firestore.FieldValue.arrayUnion({
          type: "cpx_reversal",
          offerId: offer_id || null,
          transactionId: trans_id,
          reversedAmount: reversalAmount,
          originalGross: rawAmount,
          at: admin.firestore.Timestamp.now(),
        }),
      });

      await txRef.set({
        uid,
        offerId: offer_id || null,
        reversed: true,
        reversalAmount,
        originalGross: rawAmount,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).send("Reversal OK");
      return;
    }

    // -------------------------------
    // NORMAL CREDIT — new universal system:
    // userPercent = 50% + streakBonus%
    // -------------------------------
    await admin.firestore().runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      const data = userDoc.data() || {};

      const bonusPercentRaw = typeof data.bonusPercent === "number"
        ? data.bonusPercent
        : 0;

      // userPercent = (50 + bonus)%
      const userPercent = (50 + bonusPercentRaw) / 100;

      const finalPayout = Math.round(rawAmount * userPercent * 100) / 100;
      const platformCut = rawAmount - finalPayout;
      const bonusAmount = finalPayout - (rawAmount * 0.5);

      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(finalPayout),
        auditLog: admin.firestore.FieldValue.arrayUnion({
          type: "cpx",
          offerId: offer_id || null,
          transactionId: txId,
          gross: rawAmount,
          userPercent: userPercent * 100,
          platformCut,
          bonusPercent: bonusPercentRaw,
          bonusAmount,
          creditedFinal: finalPayout,
          goal: goalValue || null,
          at: admin.firestore.Timestamp.now(),
        }),
      });

      // Global log
      tx.set(txRef, {
        uid,
        offerId: offer_id || null,
        source: "cpx",
        gross: rawAmount,
        userPercent: userPercent * 100,
        platformCut,
        bonusPercent: bonusPercentRaw,
        bonusAmount,
        creditedFinal: finalPayout,
        goal: goalValue || null,
        trans_id: txId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Per-user log
      tx.set(
        userRef.collection("offers").doc(),
        {
          offerId: offer_id || null,
          type: "cpx",
          amount: finalPayout,
          gross: rawAmount,
          userPercent: userPercent * 100,
          platformCut,
          bonusAmount,
          bonusPercent: bonusPercentRaw,
          goal: goalValue || null,
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
