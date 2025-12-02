// src/pages/Rewards.tsx
// ReadyBread — Dark glass, category-based rewards UI
// Cashouts still go through Firestore for manual processing

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  /*addDoc,*/
  setDoc,
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

// Page-specific styles
import "./styles/rewards.css";

/* ---------------------------------------------------
   Logos
--------------------------------------------------- */
import paypalLogo from "../static/images/icons/paypal.png";
import cashappLogo from "../static/images/icons/Cashapp.webp";
import venmoLogo from "../static/images/icons/venmo.png";
import bitcoinLogo from "../static/images/icons/bitcoin.svg";

import amazonLogo from "../static/images/icons/giftcards/amazon.png";
import doordashLogo from "../static/images/icons/giftcards/doordash.jpg";
import steamLogo from "../static/images/icons/giftcards/steam.jpg";
import spotifyLogo from "../static/images/icons/giftcards/spotify.png";

import dwbLogo from "../static/images/icons/drswithoutborders.png";
import redcrossLogo from "../static/images/icons/redcross.png";
import stjudesLogo from "../static/images/icons/stjudes.png";
import unicefLogo from "../static/images/icons/unicef.png";

/* ---------------------------------------------------
   Types
--------------------------------------------------- */

type PayoutMethodId = "paypal" | "cashapp" | "venmo" | "bitcoin" | "giftcard";

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

interface GiftCardOption {
  id: string;
  name: string;
  logo: string;
  amounts: number[]; // spotify = [10]
}

/* ---------------------------------------------------
   Config — Payout Methods
--------------------------------------------------- */

const mobilePayoutMethods: PayoutMethod[] = [
  {
    id: "paypal",
    name: "PayPal",
    blurb: "Fast withdrawal straight to your PayPal email.",
    logo: paypalLogo,
    brandClass: "rw-pill-paypal",
  },
  {
    id: "cashapp",
    name: "Cash App",
    headline: "U.S. only",
    blurb: "Send your earnings to your $cashtag.",
    logo: cashappLogo,
    brandClass: "rw-pill-cashapp",
  },
  {
    id: "venmo",
    name: "Venmo",
    headline: "U.S. only",
    blurb: "Instant payouts to your @venmo username.",
    logo: venmoLogo,
    brandClass: "rw-pill-venmo",
  },
];

const cryptoPayoutMethods: PayoutMethod[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    headline: "10% network fee",
    blurb: "Withdraw to a BTC address you control.",
    logo: bitcoinLogo,
    brandClass: "rw-pill-bitcoin",
  },
];

const giftCardPayoutMethods: PayoutMethod[] = [
  {
    id: "giftcard",
    name: "Gift cards",
    headline: "Pick your favs!",
    blurb: "Digital codes delivered to your email.",
    logo: doordashLogo,
    brandClass: "rw-pill-giftcard",
  },
];

/* ---------------------------------------------------
   Gift Card Options
--------------------------------------------------- */

const giftCardOptions: GiftCardOption[] = [
  {
    id: "amazon",
    name: "Amazon Gift Card",
    logo: amazonLogo,
    amounts: [5, 10, 25, 50],
  },
  {
    id: "doordash",
    name: "DoorDash Gift Card",
    logo: doordashLogo,
    amounts: [5, 10, 15, 25],
  },
  {
    id: "steam",
    name: "Steam Wallet Code",
    logo: steamLogo,
    amounts: [5, 10, 20, 25],
  },
  {
    id: "spotify",
    name: "Spotify Premium (1 Month)",
    logo: spotifyLogo,
    amounts: [10], // fixed price
  },
];

/* ---------------------------------------------------
   Charities
--------------------------------------------------- */

const charities: Charity[] = [
  {
    id: "doctors_without_borders",
    name: "Doctors Without Borders",
    blurb: "Emergency medical care around the world.",
    logo: dwbLogo,
    brandClass: "rw-pill-dwb",
  },
  {
    id: "st_jude",
    name: "St. Jude Children’s Research Hospital",
    blurb: "Supporting kids and families fighting cancer.",
    logo: stjudesLogo,
    brandClass: "rw-pill-stjude",
  },
  {
    id: "red_cross",
    name: "Red Cross",
    blurb: "Disaster relief and humanitarian aid.",
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

  const [currentBalance, setCurrentBalance] = useState(0);

  // CASHOUT MODAL
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedMethodId, setSelectedMethodId] =
    useState<PayoutMethodId | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("3.00");
  const [payoutIdentifier, setPayoutIdentifier] = useState("");

  // GIFT CARD MODAL
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftCardOption | null>(null);
  const [selectedGiftAmount, setSelectedGiftAmount] =
    useState<number | null>(null);
  const [giftcardEmail, setGiftcardEmail] = useState("");

  // DONATION MODAL
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [selectedCharityId, setSelectedCharityId] = useState<string | null>(
    null
  );
  const [donationAmount, setDonationAmount] = useState("");
  const [donationEmail, setDonationEmail] = useState("");

  /* ---------------------------------------------------
     LOGIN GATING
  --------------------------------------------------- */
  useEffect(() => {
    if (loading) return;
    if (!user) {
      alert("Please log in to view rewards.");
      navigate("/login");
      return;
    }
    if (!user.emailVerified) {
      alert("Verify your email before redeeming rewards.");
      navigate("/login");
      return;
    }
    setCurrentBalance(user.balance ?? 0);
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <main className="rb-content rewards-shell">
        <section className="rw-card rw-card-hero">
          <p>Loading rewards…</p>
        </section>
      </main>
    );
  }

  if (!user) return null;

  /* ---------------------------------------------------
     HELPERS
  --------------------------------------------------- */

  const minCashout = 3;
  const maxPerRequest = 20;

  const logPayoutHistory = async (
    payoutId: string,
    data: {
      type: "cashout" | "giftcard" | "donation";
      method: string;
      amount: number;
      status: string;
      notes?: string | null;
    }
  ) => {
    if (!user) return;
    const payoutRef = doc(db, "users", user.uid, "payouts", payoutId);
    await setDoc(
      payoutRef,
      {
        payoutId,
        ...data,
        notes: data.notes ?? null,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const computeMaxCashout = () => {
    const allowed = Math.min(currentBalance, maxPerRequest);
    return allowed < minCashout ? minCashout : allowed;
  };

  /* ---------------------------------------------------
     OPEN MODALS
  --------------------------------------------------- */

  const openPayoutModal = (methodId: PayoutMethodId) => {
    if (currentBalance < minCashout && methodId !== "giftcard") {
      alert("You need at least $3.00 to cash out.");
      return;
    }

    if (methodId === "giftcard") {
      // gift cards use a dedicated modal
      setSelectedGift(null);
      setSelectedGiftAmount(null);
      setGiftcardEmail(user.email || "");
      setShowGiftModal(true);
      return;
    }

    setSelectedMethodId(methodId);
    setPayoutAmount(minCashout.toFixed(2));

    if (methodId === "paypal") {
      setPayoutIdentifier(user.email || "");
    } else {
      setPayoutIdentifier("");
    }

    setShowPayoutModal(true);
  };

  const openDonationModal = (charityId: string) => {
    setSelectedCharityId(charityId);
    setDonationAmount("");
    setDonationEmail(user.email || "");
    setShowDonationModal(true);
  };

  /* ---------------------------------------------------
     CASHOUT SUBMIT (PayPal / CashApp / Venmo / Bitcoin)
  --------------------------------------------------- */

  const handleSubmitPayout = async () => {
    if (!user || !selectedMethodId) return;

    const amountNum = parseFloat(payoutAmount);
    
    // Apply crypto fee: user receives 90% but pays full amount
    let payoutFinal = amountNum;
    if (selectedMethodId === "bitcoin") {
      payoutFinal = parseFloat((amountNum * 0.90).toFixed(2)); // 10% network fee
    }

    if (isNaN(amountNum) || amountNum < minCashout) {
      alert(`Minimum cashout is $${minCashout.toFixed(2)}.`);
      return;
    }

    const maxAllowed = computeMaxCashout();
    if (amountNum > maxAllowed) {
      alert(`Max cashout is $${maxAllowed.toFixed(2)} for now.`);
      return;
    }

    const idValue = payoutIdentifier.trim();
    if (!idValue) {
      alert("You must enter an identifier.");
      return;
    }

    // Method-specific validation
    if (selectedMethodId === "cashapp") {
      if (!idValue.startsWith("$")) {
        alert("Cash App tags must start with $");
        return;
      }
    }

    if (selectedMethodId === "venmo") {
      if (!idValue.startsWith("@")) {
        alert("Venmo usernames must start with @");
        return;
      }
    }

    if (selectedMethodId === "paypal") {
      if (!idValue.includes("@") || !idValue.includes(".")) {
        alert("Enter a valid PayPal email.");
        return;
      }
    }

    if (selectedMethodId === "bitcoin") {
      if (idValue.length < 20) {
        alert("That BTC address looks too short.");
        return;
      }
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
          const deltaHours =
            (Date.now() - last.createdAt.toMillis()) / (1000 * 60 * 60);
          if (deltaHours < 24) {
            alert("Only one cashout every 24 hours.");
            return;
          }
        }
      }

      const cashDocRef = doc(cashRef);

      await setDoc(cashDocRef, {
        userId: user.uid,
        method: selectedMethodId,
        amount: payoutFinal,
        originalAmount: amountNum,
        paypalEmail: selectedMethodId === "paypal" ? idValue : null,
        cashappTag: selectedMethodId === "cashapp" ? idValue : null,
        venmoUsername: selectedMethodId === "venmo" ? idValue : null,
        bitcoinAddress: selectedMethodId === "bitcoin" ? idValue : null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      await logPayoutHistory(cashDocRef.id, {
        type: "cashout",
        method: selectedMethodId,
        amount: payoutFinal,
        status: "pending",
        notes: null,
      });

      // Deduct balance with fresh read
      const uRef = doc(db, "users", user.uid);
      const fresh = await getDoc(uRef);
      const bal = fresh.data()?.balance ?? 0;

      if (bal < amountNum) {
        alert("Balance changed — insufficient funds.");
        return;
      }

      await updateDoc(uRef, { balance: bal - amountNum });
      setCurrentBalance(bal - amountNum);
      await refreshProfile();

      alert("Cashout request submitted! We process requests within 72 hours.");
      setShowPayoutModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to submit cashout.");
    }
  };

  /* ---------------------------------------------------
     GIFT CARD SUBMIT
  --------------------------------------------------- */

  const handleGiftCardSubmit = async () => {
    if (!user) return;

    if (!selectedGift || !selectedGiftAmount) {
      alert("Choose a gift card and amount.");
      return;
    }

    if (!giftcardEmail.includes("@") || !giftcardEmail.includes(".")) {
      alert("Enter a valid email to receive your gift card.");
      return;
    }

    const amountNum = selectedGiftAmount;

    if (amountNum < 5 && selectedGift.id !== "spotify") {
      alert("Gift card minimum is $5 (Spotify fixed at $10).");
      return;
    }

    if (amountNum > currentBalance) {
      alert("Insufficient balance.");
      return;
    }

    try {
      const giftDocRef = doc(collection(db, "cashout_requests"));

      await setDoc(giftDocRef, {
        userId: user.uid,
        method: "giftcard",
        giftcardType: selectedGift.id,
        giftcardName: selectedGift.name,
        giftcardEmail,
        amount: amountNum,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      await logPayoutHistory(giftDocRef.id, {
        type: "giftcard",
        method: selectedGift.name,
        amount: amountNum,
        status: "pending",
        notes: null,
      });

      // Deduct balance
      const uRef = doc(db, "users", user.uid);
      const fresh = await getDoc(uRef);
      const bal = fresh.data()?.balance ?? 0;

      if (bal < amountNum) {
        alert("Balance changed — insufficient funds.");
        return;
      }

      await updateDoc(uRef, { balance: bal - amountNum });
      setCurrentBalance(bal - amountNum);
      await refreshProfile();

      alert("Gift card request submitted! We’ll email your code within 72 hours.");
      setShowGiftModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to submit gift card request.");
    }
  };

  /* ---------------------------------------------------
     DONATIONS SUBMIT
  --------------------------------------------------- */

  const selectedCharity =
    selectedCharityId != null
      ? charities.find((c) => c.id === selectedCharityId) || null
      : null;

  const handleSubmitDonation = async () => {
    if (!user || !selectedCharity) return;

    const amountNum = parseFloat(donationAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Enter a valid donation amount.");
      return;
    }

    if (amountNum > currentBalance) {
      alert("Insufficient balance.");
      return;
    }

    const email = donationEmail.trim() || null;
    const matchAmount = amountNum * 0.05;

    try {
      const donationDocRef = doc(collection(db, "donation_requests"));

      await setDoc(donationDocRef, {
        userId: user.uid,
        charityId: selectedCharity.id,
        charityName: selectedCharity.name,
        amount: amountNum,
        readybreadMatch: matchAmount,
        receiptEmail: email,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      await logPayoutHistory(donationDocRef.id, {
        type: "donation",
        method: selectedCharity.name,
        amount: amountNum,
        status: "pending",
        notes: null,
      });

      const uRef = doc(db, "users", user.uid);
      const fresh = await getDoc(uRef);
      const bal = fresh.data()?.balance ?? 0;

      if (bal < amountNum) {
        alert("Balance changed — insufficient funds.");
        return;
      }

      await updateDoc(uRef, { balance: bal - amountNum });
      setCurrentBalance(bal - amountNum);
      await refreshProfile();

      alert("Donation submitted — thank you ❤️");
      setShowDonationModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to submit donation.");
    }
  };

  const donationNum = parseFloat(donationAmount) || 0;
  const matchAmount = donationNum * 0.05;
  
  /* ---------------------------------------------------
     RENDER
  --------------------------------------------------- */
  // BTC network fee preview
  const btcReceiveAmount =
    selectedMethodId === "bitcoin"
      ? (parseFloat(payoutAmount || "0") * 0.9).toFixed(2)
      : null;

  return (
    <main className="rb-content rewards-shell">
      {/* HERO */}
      <section className="rw-card rw-card-hero">
        <div className="rw-hero-top">
          <div>
            <h2 className="rb-section-title">Cash out your earnings 💰</h2>
            <p className="rb-section-sub">
              Mobile banking, gift cards, crypto, or donations are processed
              manually within <strong>72 hours</strong>.
            </p>
          </div>
          <div className="rw-balance-chip">
            <span>Current balance</span>
            <strong>${currentBalance.toFixed(2)}</strong>
          </div>
        </div>

        <div className="rw-hero-footnote">
          <span>• Minimum cashout: $3</span>
          <span>• Max per request: $20</span>
          <span>• 1 request every 24 hours</span>
        </div>
      </section>

      {/* MOBILE BANKING */}
      <section className="rw-card">
        <div className="rw-category-header">
          <div className="rw-category-text">
            <h3 className="rw-category-title">Mobile banking</h3>
            <p className="rw-category-sub">
              Cash out to apps you already use every day.
            </p>
          </div>
        </div>
        <div className="rw-scroll-row">
          {mobilePayoutMethods.map((m) => (
            <button
              key={m.id}
              className={`rw-pill-card ${m.brandClass}`}
              onClick={() => openPayoutModal(m.id)}
            >
              <div className="rw-pill-main">
                <div className="rw-pill-text">
                  <h4>{m.name}</h4>
                  {m.headline && (
                    <span className="rw-pill-tag">{m.headline}</span>
                  )}
                  <p>{m.blurb}</p>
                </div>
                <img
                  src={m.logo}
                  className="rw-pill-logo"
                  alt={`${m.name} logo`}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* GIFT CARDS */}
      <section className="rw-card">
        <div className="rw-category-header">
          <div className="rw-category-text">
            <h3 className="rw-category-title">Gift cards</h3>
            <p className="rw-category-sub">
              Turn your balance into digital codes delivered by email.
            </p>
          </div>
        </div>
        <div className="rw-scroll-row">
          {giftCardPayoutMethods.map((m) => (
            <button
              key={m.id}
              className={`rw-pill-card ${m.brandClass}`}
              onClick={() => openPayoutModal("giftcard")}
            >
              <div className="rw-pill-main">
                <div className="rw-pill-text">
                  <h4>{m.name}</h4>
                  {m.headline && (
                    <span className="rw-pill-tag">{m.headline}</span>
                  )}
                  <p>{m.blurb}</p>
                </div>
                <img
                  src={m.logo}
                  className="rw-pill-logo"
                  alt={`${m.name} logo`}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* CRYPTO */}
      <section className="rw-card">
        <div className="rw-category-header">
          <div className="rw-category-text">
            <h3 className="rw-category-title">Crypto</h3>
            <p className="rw-category-sub">
              Cash out in Bitcoin to a wallet you control.
            </p>
          </div>
        </div>
        <div className="rw-scroll-row">
          {cryptoPayoutMethods.map((m) => (
            <button
              key={m.id}
              className={`rw-pill-card ${m.brandClass}`}
              onClick={() => openPayoutModal(m.id)}
            >
              <div className="rw-pill-main">
                <div className="rw-pill-text">
                  <h4>{m.name}</h4>
                  {m.headline && (
                    <span className="rw-pill-tag">{m.headline}</span>
                  )}
                  <p>{m.blurb}</p>
                </div>
                <img
                  src={m.logo}
                  className="rw-pill-logo"
                  alt={`${m.name} logo`}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* DONATIONS */}
      <section className="rw-card">
        <div className="rw-category-header">
          <div className="rw-category-text">
            <h3 className="rw-category-title">Donations</h3>
            <p className="rw-category-sub">
              Send your balance to charity, ReadyBread matches{" "}
              <strong>5%</strong>.
            </p>
          </div>
        </div>
        <div className="rw-scroll-row">
          {charities.map((c) => (
            <button
              key={c.id}
              className={`rw-pill-card ${c.brandClass}`}
              onClick={() => openDonationModal(c.id)}
            >
              <div className="rw-pill-main">
                <div className="rw-pill-text">
                  <h4>{c.name}</h4>
                  <p>{c.blurb}</p>
                </div>
                <img
                  src={c.logo}
                  className="rw-pill-logo"
                  alt={`${c.name} logo`}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* RULES */}
      <section className="rw-card rw-card-rules">
        <h3 className="accent-toast">Cashout rules</h3>
        <ul className="rw-rules">
          <li>Minimum cashout: $3</li>
          <li>Gift cards: minimum $5 (Spotify fixed at $10)</li>
          <li>Maximum per request: $20</li>
          <li>One cashout request every 24 hours</li>
          <li>Crypto payouts include a 10% network / processing fee</li>
          <li>All payouts are reviewed and processed manually within 72 hours</li>
        </ul>
      </section>

      {/* CASHOUT MODAL (MOBILE / CRYPTO) */}
      {showPayoutModal &&
        selectedMethodId &&
        selectedMethodId !== "giftcard" && (
          <div className="rb-modal rw-modal-root">
            <div
              className="rb-modal-backdrop rw-modal-backdrop"
              onClick={() => setShowPayoutModal(false)}
            />
            <div className="rb-modal-content rw-modal-content">
              <h3 className="rw-modal-title">
                Cash out via{" "}
                {selectedMethodId === "paypal"
                  ? "PayPal"
                  : selectedMethodId === "cashapp"
                  ? "Cash App"
                  : selectedMethodId === "venmo"
                  ? "Venmo"
                  : "Bitcoin"}
              </h3>

              <p className="rw-modal-caption">
                Requests are reviewed and paid out within 72 hours.
              </p>

              <label className="rw-field-label">Amount</label>
              <div className="rw-amount-row">
                <input
                  type="number"
                  min={minCashout}
                  max={computeMaxCashout()}
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                />
                <button
                  type="button"
                  className="rw-max-btn"
                  onClick={() =>
                    setPayoutAmount(computeMaxCashout().toFixed(2))
                  }
                >
                  Max
                </button>
              </div>
              {selectedMethodId === "bitcoin" && (
                <p className="rw-fee-note">
                <br></br>You will receive <strong>${btcReceiveAmount}</strong> after the 10% network fee.
                </p>
              )}
              <p className="rw-helper-text">
                Min ${minCashout.toFixed(2)} • Max $
                {computeMaxCashout().toFixed(2)}
              </p>

              <label className="rw-field-label">
                {selectedMethodId === "paypal"
                  ? "PayPal email"
                  : selectedMethodId === "cashapp"
                  ? "Cash App $cashtag"
                  : selectedMethodId === "venmo"
                  ? "Venmo username"
                  : "Bitcoin address"}
              </label>
              <input
                type="text"
                value={payoutIdentifier}
                onChange={(e) => setPayoutIdentifier(e.target.value)}
              />

              <div className="rw-modal-actions">
                <button className="hb-btn" onClick={handleSubmitPayout}>
                  Submit request
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => setShowPayoutModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      {/* GIFT CARD MODAL */}
      {showGiftModal && (
        <div className="rb-modal rw-modal-root">
          <div
            className="rb-modal-backdrop rw-modal-backdrop"
            onClick={() => setShowGiftModal(false)}
          />
          <div className="rb-modal-content rw-modal-content">
            <h3 className="rw-modal-title">Redeem a gift card</h3>
            <p className="rw-modal-caption">
              Choose a brand and amount. We’ll email the digital code within 72
              hours.
            </p>

            <h4 className="rw-subheading">1. Choose a brand</h4>
            <div className="giftcard-grid">
              {giftCardOptions.map((g) => (
                <button
                  key={g.id}
                  className={`giftcard-option ${
                    selectedGift?.id === g.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setSelectedGift(g);
                    setSelectedGiftAmount(null);
                  }}
                >
                  <img src={g.logo} alt={g.name} />
                  <span>{g.name}</span>
                </button>
              ))}
            </div>

            {selectedGift && (
              <>
                <h4 className="rw-subheading">2. Select amount</h4>
                <div className="giftcard-amounts">
                  {selectedGift.amounts.map((amt) => (
                    <button
                      key={amt}
                      className={`giftamt ${
                        selectedGiftAmount === amt ? "active" : ""
                      }`}
                      onClick={() => setSelectedGiftAmount(amt)}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <h4 className="rw-subheading">3. Delivery email</h4>
                <input
                  type="email"
                  value={giftcardEmail}
                  onChange={(e) => setGiftcardEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </>
            )}

            <div className="rw-modal-actions">
              <button className="hb-btn" onClick={handleGiftCardSubmit}>
                Submit request
              </button>
              <button
                className="secondary-btn"
                onClick={() => setShowGiftModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DONATION MODAL */}
      {showDonationModal && selectedCharity && (
        <div className="rb-modal rw-modal-root">
          <div
            className="rb-modal-backdrop rw-modal-backdrop"
            onClick={() => setShowDonationModal(false)}
          />
          <div className="rb-modal-content rw-modal-content">
            <h3 className="rw-modal-title">
              Donate to {selectedCharity.name}
            </h3>
            <p className="rw-modal-caption">
              ReadyBread adds a <strong>5% match</strong> on top of your
              donation.
            </p>

            <label className="rw-field-label">Donation amount</label>
            <input
              type="number"
              min={0.5}
              step="0.01"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
            />

            <p className="rw-helper-text">
              ReadyBread match: <strong>${matchAmount.toFixed(2)}</strong>
            </p>

            <label className="rw-field-label">
              Receipt email <span className="rw-field-optional">(optional)</span>
            </label>
            <input
              type="email"
              value={donationEmail}
              onChange={(e) => setDonationEmail(e.target.value)}
              placeholder={user.email || "your@email.com"}
            />

            <div className="rw-modal-actions">
              <button className="hb-btn" onClick={handleSubmitDonation}>
                Submit donation
              </button>
              <button
                className="secondary-btn"
                onClick={() => setShowDonationModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
