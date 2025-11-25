// src/pages/Rewards.tsx
// Fully converted to UserContext - no props, auto-redirect, safe balance updates.

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

/* ---------------------------------------------------
   Logos - must exist
--------------------------------------------------- */
import paypalLogo from "../static/images/icons/paypal.png";
import cashappLogo from "../static/images/icons/Cashapp.webp";
import bitcoinLogo from "../static/images/icons/bitcoin.svg";
import dwbLogo from "../static/images/icons/drswithoutborders.png";
import redcrossLogo from "../static/images/icons/redcross.png";
import stjudesLogo from "../static/images/icons/stjudes.png";
import unicefLogo from "../static/images/icons/unicef.png";

/* ---------------------------------------------------
   Types
--------------------------------------------------- */
type PayoutMethodId = "paypal" | "cashapp" | "bitcoin";

interface PayoutMethod {
  id: PayoutMethodId;
  name: string;
  headline?: string;
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

/* ---------------------------------------------------
   Config
--------------------------------------------------- */
const mobilePayoutMethods: PayoutMethod[] = [
  {
    id: "paypal",
    name: "PayPal",
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

const cryptoPayoutMethods: PayoutMethod[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    headline: "Flat 10% network fee",
    blurb: "Cash out to a BTC wallet.",
    logo: bitcoinLogo,
    brandClass: "rw-pill-bitcoin",
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
    blurb: "Helping kids fight cancer.",
    logo: stjudesLogo,
    brandClass: "rw-pill-stjude",
  },
  {
    id: "red_cross",
    name: "Red Cross",
    blurb: "Disaster relief & global support.",
    logo: redcrossLogo,
    brandClass: "rw-pill-redcross",
  },
  {
    id: "unicef",
    name: "UNICEF",
    blurb: "Protecting children worldwide.",
    logo: unicefLogo,
    brandClass: "rw-pill-unicef",
  },
];

/* ---------------------------------------------------
   Component
--------------------------------------------------- */
export const Rewards: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, refreshProfile } = useUser();

  /* UI state */
  const [currentBalance, setCurrentBalance] = useState(0);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedMethodId, setSelectedMethodId] =
    useState<PayoutMethodId | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("3.00");
  const [payoutIdentifier, setPayoutIdentifier] = useState("");

  const [showDonationModal, setShowDonationModal] = useState(false);
  const [selectedCharityId, setSelectedCharityId] =
    useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState("");
  const [donationEmail, setDonationEmail] = useState("");

  /* ---------------------------------------------------
     LOGIN + EMAIL VERIFICATION GATEKEEPER
--------------------------------------------------- */
  useEffect(() => {
    if (loading) return;

    if (!user) {
      alert("Please log in to view rewards.");
      navigate("/login");
      return;
    }

    if (!user.emailVerified) {
      alert("Please verify your email before redeeming rewards.");
      navigate("/login");
      return;
    }

    setCurrentBalance(user.balance ?? 0);
  }, [user, loading, navigate]);

  /* If user state still loading */
  if (loading) {
    return (
      <main className="rb-content rewards-shell">
        <section className="rw-card rw-card-hero">
          <p className="rb-section-sub">Loading your rewards…</p>
        </section>
      </main>
    );
  }

  if (!user) return null; // navigation already triggered

  /* ---------------------------------------------------
     Derived
--------------------------------------------------- */
  const allPayoutMethods = [
    ...mobilePayoutMethods,
    ...cryptoPayoutMethods,
  ];

  const selectedMethod =
    selectedMethodId != null
      ? allPayoutMethods.find((m) => m.id === selectedMethodId) || null
      : null;

  const parsedPayoutAmount = parseFloat(payoutAmount) || 0;
  const parsedCryptoFee =
    selectedMethod?.id === "bitcoin" ? parsedPayoutAmount * 0.1 : 0;
  const effectiveMax =
    selectedMethod?.id === "bitcoin"
      ? Math.min(20, currentBalance / 1.1)
      : Math.min(20, currentBalance);
  const totalRequested =
    selectedMethod?.id === "bitcoin"
      ? parsedPayoutAmount + parsedCryptoFee
      : parsedPayoutAmount;

  const selectedCharity =
    selectedCharityId != null
      ? charities.find((c) => c.id === selectedCharityId) || null
      : null;

  /* ---------------------------------------------------
     PAYOUT – open modal
--------------------------------------------------- */
  const openPayoutModal = (methodId: PayoutMethodId) => {
    if (!user) return;

    const bal = user.balance ?? 0;
    const max = Math.min(20, bal);

    if (bal < 3) {
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

  /* ---------------------------------------------------
     PAYOUT – submit
--------------------------------------------------- */
  const handleSubmitPayout = async () => {
    if (!user || !selectedMethod) return;

    const amountNum = parseFloat(payoutAmount);
    const cryptoFeeNum =
      selectedMethod.id === "bitcoin" ? amountNum * 0.1 : 0;

    if (isNaN(amountNum) || amountNum < 3) {
      alert("Minimum cashout is $3.00.");
      return;
    }

    const max =
      selectedMethod.id === "bitcoin"
        ? Math.min(20, currentBalance / 1.1)
        : Math.min(20, currentBalance);
    if (amountNum > max) {
      alert(`You can cash out at most $${max.toFixed(2)} right now.`);
      return;
    }

    if (selectedMethod.id === "bitcoin" && amountNum + cryptoFeeNum > currentBalance) {
      alert("Your requested amount plus the crypto fee exceeds your balance.");
      return;
    }

    const idValue = payoutIdentifier.trim();
    if (!idValue) {
      alert(
        selectedMethod.id === "paypal"
          ? "Enter a PayPal email."
          : selectedMethod.id === "cashapp"
            ? "Enter your Cash App $cashtag."
            : "Enter your Bitcoin address."
      );
      return;
    }

    let normalizedTag = idValue;
    if (selectedMethod.id === "cashapp") {
      if (!normalizedTag.startsWith("$")) normalizedTag = `$${normalizedTag}`;
      if (normalizedTag.length < 3) {
        alert("Enter a valid Cash App tag.");
        return;
      }
    }

    if (selectedMethod.id === "bitcoin" && normalizedTag.length < 20) {
      alert("Enter a valid Bitcoin address.");
      return;
    }

    try {
      // Enforce 24h rule
      const cashRef = collection(db, "cashout_requests");
      const qRecent = query(
        cashRef,
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      const snap = await getDocs(qRecent);
      if (!snap.empty) {
        const last = snap.docs[0].data();
        if (last.createdAt?.toMillis) {
          const delta =
            (Date.now() - last.createdAt.toMillis()) / (1000 * 60 * 60);
          if (delta < 24) {
            alert("You may only request one cashout per 24 hours.");
            return;
          }
        }
      }

      // Create request
      await addDoc(cashRef, {
        userId: user.uid,
        amount: amountNum,
        method: selectedMethod.id,
        paypalEmail: selectedMethod.id === "paypal" ? idValue : null,
        cashappTag: selectedMethod.id === "cashapp" ? normalizedTag : null,
        bitcoinAddress: selectedMethod.id === "bitcoin" ? normalizedTag : null,
        cryptoFee: selectedMethod.id === "bitcoin" ? cryptoFeeNum : null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Deduct from balance
      const uRef = doc(db, "users", user.uid);
      const fresh = await getDoc(uRef);
      const freshBal = (fresh.data()?.balance ?? 0) as number;

      const totalDebit = selectedMethod.id === "bitcoin" ? amountNum + cryptoFeeNum : amountNum;

      if (freshBal < totalDebit) {
        alert("Balance changed - not enough funds.");
        return;
      }

      await updateDoc(uRef, { balance: freshBal - totalDebit });
      setCurrentBalance(freshBal - totalDebit);

      await refreshProfile();

      const confirmation =
        selectedMethod.id === "bitcoin"
          ? `Cashout for $${amountNum.toFixed(2)} (+$${cryptoFeeNum.toFixed(2)} crypto fee) submitted!`
          : `Cashout request for $${amountNum.toFixed(2)} submitted!`;

      alert(confirmation);
      setShowPayoutModal(false);
    } catch (err) {
      console.error(err);
      alert("Something went wrong - try again.");
    }
  };

  /* ---------------------------------------------------
     DONATIONS – open modal
--------------------------------------------------- */
  const openDonationModal = (charityId: string) => {
    if (!user) return;
    setSelectedCharityId(charityId);
    setDonationAmount("");
    setDonationEmail(user.email || "");
    setShowDonationModal(true);
  };

  /* ---------------------------------------------------
     DONATIONS – submit
--------------------------------------------------- */
  const handleSubmitDonation = async () => {
    if (!user || !selectedCharity) return;

    const amountNum = parseFloat(donationAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Enter a valid amount.");
      return;
    }
    if (amountNum > currentBalance) {
      alert("Insufficient balance.");
      return;
    }

    const email = donationEmail.trim() || null;
    const matchAmount = amountNum * 0.05;

    try {
      await addDoc(collection(db, "donation_requests"), {
        userId: user.uid,
        charityId: selectedCharity.id,
        charityName: selectedCharity.name,
        amount: amountNum,
        readybreadMatch: matchAmount,
        receiptEmail: email,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      const uRef = doc(db, "users", user.uid);
      const fresh = await getDoc(uRef);
      const freshBal = (fresh.data()?.balance ?? 0) as number;

      if (freshBal < amountNum) {
        alert("Balance changed - not enough funds.");
        return;
      }

      await updateDoc(uRef, { balance: freshBal - amountNum });
      setCurrentBalance(freshBal - amountNum);

      await refreshProfile();

      alert(`Donation of $${amountNum.toFixed(2)} submitted!`);
      setShowDonationModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to submit donation.");
    }
  };

  /* ---------------------------------------------------
     Donation Calculator
--------------------------------------------------- */
  const donationNum = parseFloat(donationAmount) || 0;
  const matchAmount = donationNum * 0.05;
  const totalImpact = donationNum + matchAmount;

  /* ---------------------------------------------------
     RENDER
--------------------------------------------------- */
  return (
    <main className="rb-content rewards-shell">
      {/* HERO CARD */}
      <section className="rw-card rw-card-hero">
        <h2 className="rb-section-title">Time to have your cake and eat it too.</h2>
        <p className="rb-section-sub">Cash out or donate; crypto payouts include a flat 10% network fee.</p>
        <div className="rw-balance-line">
          <span>Your current balance:</span>
          <strong>${currentBalance.toFixed(2)}</strong>
        </div>
      </section>

      {/* PAYOUT METHODS */}
      <section className="rw-card">
        <h3 className="rw-row-title">Mobile Banking 🏦</h3>
        <p className="rw-row-sub">Choose your withdrawal method.</p>

        <div className="rw-row-strip">
          {mobilePayoutMethods.map((m) => (
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

      {/* CRYPTO */}
      <section className="rw-card">
        <h3 className="rw-row-title">Crypto</h3>
        <p className="rw-row-sub">Bitcoin cashouts through Cash App. Flat 10% network fee. 
          You must enter the bitcoin address correctly, as we will not refund errors via crypto.</p>

        <div className="rw-row-strip">
          {cryptoPayoutMethods.map((m) => (
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
        <h3 className="rw-row-title">Donations (We match 5%) 🤝</h3>
        <p className="rw-row-sub">Support global charities with a bonus match.</p>

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

      {/* RULES */}
      <section className="rw-card">
        <h3 className="accent-toast">Cashout & Donation Rules</h3>
        <ul className="rw-rules">
          <li>Minimum cashout: <b>$3.00</b></li>
          <li>Maximum per request: <b>$20</b></li>
          <li>Limit: <b>1 cashout per 24 hours</b></li>
          <li>Only fee: flat 10% on crypto to cover network costs.</li>
          <li>Donations matched by <b>5%</b>.</li>
        </ul>
      </section>

      {/* PAYOUT MODAL */}
      {showPayoutModal && selectedMethod && (
        <div className="rb-modal">
          <div className="rb-modal-backdrop" onClick={() => setShowPayoutModal(false)} />
          <div className="rb-modal-content">
            <h3 className="accent-toast">Cash out via {selectedMethod.name}</h3>
            <p className="soft-text">
              Allowed: <b>$3.00</b> - <b>${effectiveMax.toFixed(2)}</b> (amount before any crypto fee).
            </p>

            <label className="modal-label">Amount (USD)</label>
            <input
              type="number"
              min={3}
              max={effectiveMax}
              step="0.01"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
            />

            <label className="modal-label">
              {selectedMethod.id === "paypal"
                ? "PayPal Email"
                : selectedMethod.id === "cashapp"
                  ? "Cash App $cashtag"
                  : "Bitcoin address"}
            </label>
            <input
              type={selectedMethod.id === "paypal" ? "email" : "text"}
              value={payoutIdentifier}
              onChange={(e) => setPayoutIdentifier(e.target.value)}
              placeholder={
                selectedMethod.id === "paypal"
                  ? "name@email.com"
                  : selectedMethod.id === "cashapp"
                    ? "$cashtag"
                    : "bc1..."
              }
            />

            {selectedMethod.id === "bitcoin" && (
              <div className="crypto-fee-note">
                <div className="crypto-fee-label">
                  Crypto fee (10%)
                  <span
                    className="crypto-fee-help"
                    title="Crypto network fees are high, so we pass them through. This is the only fee we charge."
                  >
                    ?
                  </span>
                </div>
                <p>
                  Fee: <b>${parsedCryptoFee.toFixed(2)}</b>
                  {"  "}Total deducted: <b>${totalRequested.toFixed(2)}</b>
                </p>
              </div>
            )}

            <div className="rb-modal-actions">
              <button className="hb-btn" onClick={handleSubmitPayout}>
                Submit Request
              </button>
              <button className="secondary-btn" onClick={() => setShowPayoutModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DONATION MODAL */}
      {showDonationModal && selectedCharity && (
        <div className="rb-modal">
          <div className="rb-modal-backdrop" onClick={() => setShowDonationModal(false)} />
          <div className="rb-modal-content">
            <h3 className="accent-toast">Donate to {selectedCharity.name}</h3>

            <label className="modal-label">Amount (USD)</label>
            <input
              type="number"
              min={0.5}
              step="0.01"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
            />

            <div className="donation-calculator">
              <p>ReadyBread match (5%): <b>${matchAmount.toFixed(2)}</b></p>
              <p>Total impact: <b>${totalImpact.toFixed(2)}</b></p>
            </div>

            <label className="modal-label">Receipt email (optional)</label>
            <input
              type="email"
              value={donationEmail}
              onChange={(e) => setDonationEmail(e.target.value)}
            />

            <div className="rb-modal-actions">
              <button className="hb-btn" onClick={handleSubmitDonation}>
                Submit Donation
              </button>
              <button className="secondary-btn" onClick={() => setShowDonationModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
