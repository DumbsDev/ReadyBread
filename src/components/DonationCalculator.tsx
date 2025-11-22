import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import type { User } from "../types/index";

interface DonationCalculatorProps {
  user: User;
}

export const DonationCalculator: React.FC<DonationCalculatorProps> = ({ user }) => {
  const [donation, setDonation] = useState("");
  const [emailReceipt, setEmailReceipt] = useState("");

  const donationNumber = parseFloat(donation) || 0;
  const rbMatch = donationNumber * 0.05;
  const totalImpact = donationNumber + rbMatch;

  const handleSubmitDonation = async () => {
    if (donationNumber <= 0) {
      alert("Enter a valid donation amount.");
      return;
    }

    try {
      await addDoc(collection(db, "donation_requests"), {
        userId: user.uid,
        userEmail: user.email,
        forwardEmail: emailReceipt.trim() || null,
        amount: donationNumber,
        rbMatchAmount: rbMatch,
        totalImpact: totalImpact,
        createdAt: serverTimestamp()
      });

      alert("Thank you for donating! We will forward your receipt soon.");
      setDonation("");
      setEmailReceipt("");
    } catch (err) {
      console.error(err);
      alert("Error submitting donation.");
    }
  };

  return (
    <div className="donation-card">
      <h3 className="accent-toast">Donation Calculator</h3>

      <p className="soft-text">
        ReadyBread matches <b>5%</b> of every donation ❤️
      </p>

      <label className="modal-label" htmlFor="donation-amount">
        Donation Amount (USD)
      </label>
      <input
        type="number"
        id="donation-amount"
        min="1"
        step="0.01"
        placeholder="e.g. 10.00"
        value={donation}
        onChange={(e) => setDonation(e.target.value)}
      />

      <label className="modal-label" htmlFor="donation-email">
        Receipt Email (optional)
      </label>
      <input
        type="email"
        id="donation-email"
        placeholder="Where should we send a receipt?"
        value={emailReceipt}
        onChange={(e) => setEmailReceipt(e.target.value)}
      />

      <div className="donation-breakdown">
        <p>You donate: <b>${donationNumber.toFixed(2)}</b></p>
        <p>ReadyBread adds: <b>${rbMatch.toFixed(2)}</b></p>

        <p className="donation-total">
          Total impact: <b>${totalImpact.toFixed(2)}</b>
        </p>
      </div>

      <button className="hb-btn" onClick={handleSubmitDonation}>
        Submit Donation
      </button>
    </div>
  );
};
