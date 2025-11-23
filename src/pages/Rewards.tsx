// src/pages/Rewards.tsx
// Multi-method cashout + donations with glass cards and logos
// Now powered by UserContext (ReadyBreadUser) instead of props.

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useUser } from "../contexts/UserContext";

// Logos (ensure these paths/files exist)
import paypalLogo from "../static/images/icons/paypal.png";
import cashappLogo from "../static/images/icons/Cashapp.webp";
import dwbLogo from "../static/images/icons/drswithoutborders.png";
import redcrossLogo from "../static/images/icons/redcross.png";
import stjudesLogo from "../static/images/icons/stjudes.png";
import unicefLogo from "../static/images/icons/unicef.png";

type PayoutMethodId = "paypal" | "cashapp";

interface PayoutMethod {
  id: PayoutMethodId;
  name: string;
  headline: string;
  blurb: string;
  logo: string;
  brandClass: string;
}

interface Charity {
  id: string;
  name: string;
  blurb: string;
  logo: string;
  brandClass: string;
}

const payoutMethods: PayoutMethod[] = [
  {
    id: "paypal",
    name: "PayPal",
    headline: "",
    blurb: "Fast withdrawal straight to PayPal.",
    logo: paypalLogo,
    brandClass: "rw-pill-paypal",
  },
  {
    id: "cashapp",
    name: "Cash App",
    headline: "U.S. Exclusive",
    blurb: "Send your earnings to your Cash App.",
    logo: cashappLogo,
    brandClass: "rw-pill-cashapp",
  },
];

const charities: Charity[] = [
  {
    id: "doctors_without_borders",
    name: "Doctors Without Borders",
    blurb: "Emergency medical aid where it’s needed most.",
    logo: dwbLogo,
    brandClass: "rw-pill-dwb",
  },
  {
    id: "st_jude",
    name: "St. Jude Children’s Research Hospital",
    blurb: "Helping kids fight cancer and other life-threatening diseases.",
    logo: stjudesLogo,
    brandClass: "rw-pill-stjude",
  },
  {
    id: "red_cross",
    name: "Red Cross",
    blurb: "Disaster relief and community support worldwide.",
    logo: redcrossLogo,
    brandClass: "rw-pill-redcross",
  },
  {
    id: "unicef",
    name: "UNICEF",
    blurb: "Protecting children and families across the globe.",
    logo: unicefLogo,
    brandClass: "rw-pill-unicef",
  },
];

export const Rewards: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, refreshProfile } = useUser();

  const [currentBalance, setCurrentBalance] = useState(0);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedMethodId, setSelectedMethodId] =
    useState<PayoutMethodId | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("3.00");
  const [payoutIdentifier, setPayoutIdentifier] = useState("");

  const [showDonationModal, setShowDonationModal] = useState(false);
  const [selectedCharityId, setSelectedCharityId] = useState<string | null>(
    null
  );
  const [donationAmount, setDonationAmount] = useState("");
  const [donationEmail, setDonationEmail] = useState("");

  // Require login + have user doc before using this page
  useEffect(() => {
    if (loading) return;

    if (!user) {
      alert("Please log in to view rewards.");
      navigate("/login");
      return;
    }

    setCurrentBalance(user.balance ?? 0);
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <main className="rb-content rewards-shell">
        <section className="rw-card rw-card-hero">
          <p className="rb-section-sub">Loading your rewards…</p>
        </section>
      </main>
    );
  }

  if (!user) {
    // The effect above will already navigate; this is just a safety fallback.
    return null;
  }

  const effectiveMax = Math.min(20, currentBalance);

  const selectedMethod =
    selectedMethodId != null
      ? payoutMethods.find((m) => m.id === selectedMethodId) || null
      : null;

  const selectedCharity =
    selectedCharityId != null
      ? charities.find((c) => c.id === selectedCharityId) || null
      : null;

  /* -----------------------------
     OPEN PAYOUT MODAL
  ----------------------------- */
  const openPayoutModal = (methodId: PayoutMethodId) => {
    if (!user) return;

    const balance = user.balance ?? 0;
    const max = Math.min(20, balance);

    if (balance < 3) {
      alert("You need at least $3.00 to cash out.");
      return;
    }

    setSelectedMethodId(methodId);
    setPayoutAmount(max >= 3 ? "3.00" : "");
    if (methodId === "paypal") {
      setPayoutIdentifier(user.email || "");
    } else {
      setPayoutIdentifier("");
    }
    setShowPayoutModal(true);
  };

  /* -----------------------------
     SUBMIT PAYOUT REQUEST
  ----------------------------- */
  const handleSubmitPayout = async () => {
    if (!user || !selectedMethod) return;

    const amountNum = parseFloat(payoutAmount);
    const idValue = payoutIdentifier.trim();

    if (isNaN(amountNum) || amountNum < 3) {
      alert("Minimum cashout is $3.00.");
      return;
    }

    const max = Math.min(20, currentBalance);
    if (amountNum > max) {
      alert(`You can request at most $${max.toFixed(2)} right now.`);
      return;
    }

    if (!idValue) {
      alert(
        selectedMethod.id === "paypal"
          ? "Please enter a valid PayPal email."
          : "Please enter your Cash App $cashtag."
      );
      return;
    }

    if (selectedMethod.id === "paypal" && !idValue.includes("@")) {
      alert("Enter a valid PayPal email.");
      return;
    }

    let normalizedTag = idValue;
    if (selectedMethod.id === "cashapp") {
      if (!normalizedTag.startsWith("$")) {
        normalizedTag = `$${normalizedTag}`;
      }
      if (normalizedTag.length < 3) {
        alert("Enter a valid Cash App $cashtag.");
        return;
      }
    }

    try {
      // 1) Enforce 24h limit
      const requestsRef = collection(db, "cashout_requests");
      const qRecent = query(
        requestsRef,
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const recentSnap = await getDocs(qRecent);
      if (!recentSnap.empty) {
        const lastRequest = recentSnap.docs[0].data();
        if (lastRequest.createdAt && lastRequest.createdAt.toMillis) {
          const now = Date.now();
          const lastTime = lastRequest.createdAt.toMillis();
          const hoursSince = (now - lastTime) / (1000 * 60 * 60);
          if (hoursSince < 24) {
            alert("You can only request one cashout every 24 hours.");
            return;
          }
        }
      }

      // 2) Create cashout request
      await addDoc(requestsRef, {
        userId: user.uid,
        amount: amountNum,
        method: selectedMethod.id,
        paypalEmail: selectedMethod.id === "paypal" ? idValue : null,
        cashappTag: selectedMethod.id === "cashapp" ? normalizedTag : null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // 3) Deduct from user balance (fresh snapshot)
      const userRef = doc(db, "users", user.uid);
      const freshDoc = await getDoc(userRef);
      const freshBalance = (freshDoc.data()?.balance ?? 0) as number;

      if (freshBalance < amountNum) {
        alert("Your balance changed. Not enough funds.");
        return;
      }

      const newBalance = freshBalance - amountNum;
      await updateDoc(userRef, { balance: newBalance });
      setCurrentBalance(newBalance);

      await refreshProfile();

      alert(
        `Cashout request for $${amountNum.toFixed(
          2
        )} via ${selectedMethod.name} submitted!`
      );
      setShowPayoutModal(false);
    } catch (err) {
      console.error("Cashout error:", err);
      alert("Error submitting request. Please try again later.");
    }
  };

  /* -----------------------------
     OPEN DONATION MODAL
  ----------------------------- */
  const openDonationModal = (charityId: string) => {
    if (!user) return;
    setSelectedCharityId(charityId);
    setDonationAmount("");
    setDonationEmail(user.email || "");
    setShowDonationModal(true);
  };

  /* -----------------------------
     SUBMIT DONATION REQUEST
  ----------------------------- */
  const handleSubmitDonation = async () => {
    if (!user || !selectedCharity) return;

    const amountNum = parseFloat(donationAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Enter a valid donation amount.");
      return;
    }
    if (amountNum > currentBalance) {
      alert("You don’t have enough balance for that donation amount.");
      return;
    }

    const email = donationEmail.trim() || null;
    const matchAmount = amountNum * 0.05;

    try {
      const donationsRef = collection(db, "donation_requests");
      await addDoc(donationsRef, {
        userId: user.uid,
        charityId: selectedCharity.id,
        charityName: selectedCharity.name,
        amount: amountNum,
        readybreadMatch: matchAmount,
        receiptEmail: email,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      const userRef = doc(db, "users", user.uid);
      const freshDoc = await getDoc(userRef);
      const freshBalance = (freshDoc.data()?.balance ?? 0) as number;

      if (freshBalance < amountNum) {
        alert("Your balance changed. Not enough funds to donate.");
        return;
      }

      const newBalance = freshBalance - amountNum;
      await updateDoc(userRef, { balance: newBalance });
      setCurrentBalance(newBalance);

      await refreshProfile();

      alert(
        `Donation of $${amountNum.toFixed(
          2
        )} to ${selectedCharity.name} submitted!`
      );
      setShowDonationModal(false);
    } catch (err) {
      console.error("Donation error:", err);
      alert("Error submitting donation. Please try again later.");
    }
  };

  const donationNum = parseFloat(donationAmount) || 0;
  const matchAmount = donationNum > 0 ? donationNum * 0.05 : 0;
  const totalImpact = donationNum + matchAmount;

  return (
    <main className="rb-content rewards-shell">
      {/* HERO CARD */}
      <section className="rw-card rw-card-hero">
        <h2 className="rb-section-title">
          Time to have your cake, and eat it too.
        </h2>
        <p className="rb-section-sub">
          Cash out your ReadyBread balance or donate directly to trusted
          charities. No fees, ever.
        </p>

        <div className="rw-balance-line">
          <span>Your current balance:</span>
          <strong>${currentBalance.toFixed(2)}</strong>
        </div>
      </section>

      {/* MOBILE BANKING */}
      <section className="rw-card">
        <div className="rw-row-header">
          <div>
            <h3 className="rw-row-title">
              Mobile Banking <span className="emoji">🏦</span>
            </h3>
            <p className="rw-row-sub">
              Slide through to pick how you want your bread delivered.
            </p>
          </div>
        </div>

        <div className="rw-row-strip">
          {payoutMethods.map((m) => (
            <button
              key={m.id}
              className={`rw-pill-card ${m.brandClass}`}
              onClick={() => openPayoutModal(m.id)}
            >
              <div className="rw-pill-main">
                <div className="rw-pill-text">
                  <h4>{m.name}</h4>
                  <p className="rw-pill-headline">{m.headline}</p>
                  <p className="rw-pill-blurb">{m.blurb}</p>
                </div>
                <div className="rw-pill-logo">
                  <img src={m.logo} alt={`${m.name} logo`} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* DONATIONS */}
      <section className="rw-card">
        <div className="rw-row-header">
          <div>
            <h3 className="rw-row-title">
              Donations (ReadyBread matches 5%){" "}
              <span className="emoji">🤝</span>
            </h3>
            <p className="rw-row-sub">
              Support global charities and we’ll add an extra 5% on top of your
              donation.
            </p>
          </div>
        </div>

        <div className="rw-row-strip">
          {charities.map((c) => (
            <button
              key={c.id}
              className={`rw-pill-card ${c.brandClass}`}
              onClick={() => openDonationModal(c.id)}
            >
              <div className="rw-pill-main">
                <div className="rw-pill-text">
                  <h4>{c.name}</h4>
                  <p className="rw-pill-blurb">{c.blurb}</p>
                </div>
                <div className="rw-pill-logo">
                  <img src={c.logo} alt={`${c.name} logo`} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* RULES CARD */}
      <section className="rw-card">
        <h3 className="accent-toast">Cashout & Donation Rules</h3>
        <ul className="rw-rules">
          <li>
            Minimum cashout: <b>$3.00</b>
          </li>
          <li>
            Maximum cashout per request: <b>$20.00</b>
          </li>
          <li>
            Limit: <b>one cashout request every 24 hours</b>
          </li>
          <li>No fees. You receive the exact amount requested.</li>
          <li>Requests are processed manually and may take up to 72 hours.</li>
          <li>
            Donations: ReadyBread will match your donation by{" "}
            <b>5% (on our side)</b>.
          </li>
        </ul>
      </section>

      {/* PAYOUT MODAL */}
      {showPayoutModal && selectedMethod && (
        <div className="rb-modal">
          <div
            className="rb-modal-backdrop"
            onClick={() => setShowPayoutModal(false)}
          />
          <div className="rb-modal-content">
            <h3 className="accent-toast">
              Cash out via {selectedMethod.name}
            </h3>
            <p className="soft-text">
              You can request between <b>$3.00</b> and{" "}
              <b>${effectiveMax.toFixed(2)}</b> today.
            </p>

            <label htmlFor="payout-amount" className="modal-label">
              Amount (USD)
            </label>
            <input
              type="number"
              id="payout-amount"
              min={3}
              max={effectiveMax}
              step="0.01"
              placeholder="e.g. 5.00"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
            />

            <label htmlFor="payout-identifier" className="modal-label">
              {selectedMethod.id === "paypal"
                ? "PayPal Email"
                : "Cash App $cashtag"}
            </label>
            <input
              type={selectedMethod.id === "paypal" ? "email" : "text"}
              id="payout-identifier"
              placeholder={
                selectedMethod.id === "paypal"
                  ? "paypal@example.com"
                  : "$yourcashtag"
              }
              value={payoutIdentifier}
              onChange={(e) => setPayoutIdentifier(e.target.value)}
            />

            <div className="rb-modal-actions">
              <button className="hb-btn" onClick={handleSubmitPayout}>
                Submit Request
              </button>
              <button
                className="secondary-btn"
                onClick={() => setShowPayoutModal(false)}
              >
                Cancel
              </button>
            </div>

            <p className="soft-text tiny">
              Cashout requests are reviewed manually. Please allow up to
              72 hours.
            </p>
          </div>
        </div>
      )}

      {/* DONATION MODAL */}
      {showDonationModal && selectedCharity && (
        <div className="rb-modal">
          <div
            className="rb-modal-backdrop"
            onClick={() => setShowDonationModal(false)}
          />
          <div className="rb-modal-content">
            <h3 className="accent-toast">
              Donate to {selectedCharity.name}
            </h3>
            <p className="soft-text">
              Choose an amount to donate from your ReadyBread balance. We’ll
              match <b>5%</b> on top.
            </p>

            <label htmlFor="donation-amount" className="modal-label">
              Donation amount (USD)
            </label>
            <input
              type="number"
              id="donation-amount"
              min={0.5}
              step="0.01"
              placeholder="e.g. 5.00"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
            />

            <div className="donation-calculator">
              <p>
                ReadyBread match (5%): <b>${matchAmount.toFixed(2)}</b>
              </p>
              <p>
                Total impact (you + match):{" "}
                <b>${totalImpact.toFixed(2)}</b>
              </p>
            </div>

            <label htmlFor="donation-email" className="modal-label">
              Receipt email (optional)
            </label>
            <input
              type="email"
              id="donation-email"
              placeholder="you@example.com"
              value={donationEmail}
              onChange={(e) => setDonationEmail(e.target.value)}
            />

            <div className="rb-modal-actions">
              <button className="hb-btn" onClick={handleSubmitDonation}>
                Submit Donation
              </button>
              <button
                className="secondary-btn"
                onClick={() => setShowDonationModal(false)}
              >
                Cancel
              </button>
            </div>

            <p className="soft-text tiny">
              Donations are processed manually. Your support + our 5% match goes
              directly to <b>{selectedCharity.name}</b>.
            </p>
          </div>
        </div>
      )}
    </main>
  );
};
