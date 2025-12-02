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
      g,
      et,
      event_id,
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
    // REVERSAL CASE (status 2)
    // -------------------------------
    if (String(status) === "2") {
      const reversalAmount = rawAmount * 0.5; // reverse only the user's 50% base

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

    // ------------------------------------------------------
    // NORMAL CREDIT — NEW SYSTEM:
    // Step 1: Your commission (50%) is taken first
    // Step 2: User streak bonus = (dailyStreak / 2)% is applied
    //
    // finalPayout = (rawAmount * 0.5) * (1 + (dailyStreak/2)/100)
    // ------------------------------------------------------
    await admin.firestore().runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      const data = userDoc.data() || {};

      const dailyStreak =
        typeof data.dailyStreak === "number" && isFinite(data.dailyStreak)
          ? data.dailyStreak
          : 0;

      const bonusPercent = dailyStreak / 2; // 0.5% per day
      const bonusMultiplier = 1 + bonusPercent / 100;

      // YOUR COMMISSION FIRST
      const userBaseCut = rawAmount * 0.5;

      // APPLY STREAK BONUS
      const finalPayout =
        Math.round(userBaseCut * bonusMultiplier * 100) / 100;

      const bonusAmount = finalPayout - userBaseCut;

      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(finalPayout),
        auditLog: admin.firestore.FieldValue.arrayUnion({
          type: "cpx",
          offerId: offer_id || null,
          transactionId: txId,
          gross: rawAmount,
          commissionTaken: rawAmount - userBaseCut,
          userBaseCut,
          dailyStreak,
          bonusPercent,
          bonusMultiplier,
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
        commissionTaken: rawAmount - userBaseCut,
        userBaseCut,
        dailyStreak,
        bonusPercent,
        bonusMultiplier,
        bonusAmount,
        creditedFinal: finalPayout,
        goal: goalValue || null,
        trans_id: txId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Per-user log collection
      tx.set(
        userRef.collection("offers").doc(),
        {
          offerId: offer_id || null,
          type: "cpx",
          amount: finalPayout,
          gross: rawAmount,
          commissionTaken: rawAmount - userBaseCut,
          userBaseCut,
          dailyStreak,
          bonusPercent,
          bonusMultiplier,
          bonusAmount,
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
