// src/pages/Rewards.tsx
// Full version with PayPal, CashApp, Venmo, Bitcoin, Donations,
// AND Gift Cards: Amazon, DoorDash, Steam, Spotify Premium (fixed $10)

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
type PayoutMethodId =
  | "paypal"
  | "cashapp"
  | "venmo"
  | "bitcoin"
  | "giftcard";

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
   Gift Card Config
--------------------------------------------------- */

interface GiftCardOption {
  id: string;
  name: string;
  logo: string;
  amounts: number[]; // spotify = [10]
}

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
   Payout Method Config
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
  {
    id: "venmo",
    name: "Venmo",
    headline: "U.S. Exclusive",
    blurb: "Fast payouts to your Venmo account.",
    logo: venmoLogo,
    brandClass: "rw-pill-venmo",
  },
];

const cryptoPayoutMethods: PayoutMethod[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    headline: "10% Network Fee",
    blurb: "Withdraw to a BTC wallet.",
    logo: bitcoinLogo,
    brandClass: "rw-pill-bitcoin",
  },
];

const giftCardPayoutMethods: PayoutMethod[] = [
  {
    id: "giftcard",
    name: "Gift Cards",
    headline: "Amazon, DoorDash, Steam & More",
    blurb: "Redeem digital gift cards delivered by email.",
    logo: amazonLogo,
    brandClass: "rw-pill-giftcard",
  },
];

/* ---------------------------------------------------
   Charities
--------------------------------------------------- */
const charities: Charity[] = [
  {
    id: "doctors_without_borders",
    name: "Doctors Without Borders",
    blurb: "Emergency medical care worldwide.",
    logo: dwbLogo,
    brandClass: "rw-pill-dwb",
  },
  {
    id: "st_jude",
    name: "St. Jude Children’s Research Hospital",
    blurb: "Supporting kids fighting cancer.",
    logo: stjudesLogo,
    brandClass: "rw-pill-stjude",
  },
  {
    id: "red_cross",
    name: "Red Cross",
    blurb: "Disaster relief and global aid.",
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
  const [selectedMethodId, setSelectedMethodId] = useState<PayoutMethodId | null>(
    null
  );
  const [payoutAmount, setPayoutAmount] = useState("3.00");
  const [payoutIdentifier, setPayoutIdentifier] = useState("");

  /* GIFT CARD modal */
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftCardOption | null>(null);
  const [selectedGiftAmount, setSelectedGiftAmount] = useState<number | null>(
    null
  );
  const [giftcardEmail, setGiftcardEmail] = useState("");

  /* DONATIONS */
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
     PAYOUT OPEN
--------------------------------------------------- */
  const openPayoutModal = (methodId: PayoutMethodId) => {
    if (currentBalance < 3) {
      alert("You need at least $3.00 to cash out.");
      return;
    }

    if (methodId === "giftcard") {
      setShowGiftModal(true);
      return;
    }

    setSelectedMethodId(methodId);
    setPayoutAmount("3.00");

    if (methodId === "paypal") setPayoutIdentifier(user.email || "");
    else setPayoutIdentifier("");

    setShowPayoutModal(true);
  };

  /* ---------------------------------------------------
     PAYOUT SUBMIT
     (PayPal / CashApp / Venmo / Bitcoin)
--------------------------------------------------- */
  const handleSubmitPayout = async () => {
    if (!user || !selectedMethodId) return;

    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum < 3) {
      alert("Minimum is $3.00.");
      return;
    }
    if (amountNum > Math.min(20, currentBalance)) {
      alert("Max cashout is $20.00.");
      return;
    }

    const idValue = payoutIdentifier.trim();
    if (!idValue) {
      alert("You must enter an identifier.");
      return;
    }

    /* VALIDATION */
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
      if (!idValue.includes("@")) {
        alert("Enter a valid PayPal email.");
        return;
      }
    }

    if (selectedMethodId === "bitcoin") {
      if (idValue.length < 20) {
        alert("Invalid BTC address.");
        return;
      }
    }

    /* SUBMIT */
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
            alert("Only 1 cashout per 24 hours.");
            return;
          }
        }
      }

      await addDoc(cashRef, {
        userId: user.uid,
        method: selectedMethodId,
        amount: amountNum,
        paypalEmail: selectedMethodId === "paypal" ? idValue : null,
        cashappTag: selectedMethodId === "cashapp" ? idValue : null,
        venmoUsername: selectedMethodId === "venmo" ? idValue : null,
        bitcoinAddress: selectedMethodId === "bitcoin" ? idValue : null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Deduct balance
      const uRef = doc(db, "users", user.uid);
      const fresh = await getDoc(uRef);
      const bal = fresh.data()?.balance ?? 0;
      if (bal < amountNum) {
        alert("Balance changed - insufficient funds.");
        return;
      }

      await updateDoc(uRef, { balance: bal - amountNum });
      setCurrentBalance(bal - amountNum);
      await refreshProfile();

      alert("Cashout submitted!");
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
    if (!selectedGift || !selectedGiftAmount) {
      alert("Choose a gift card and amount.");
      return;
    }

    if (!giftcardEmail.includes("@")) {
      alert("Enter a valid email to receive your gift card.");
      return;
    }

    const amountNum = selectedGiftAmount;

    if (amountNum < 5 && selectedGift.id !== "spotify") {
      alert("Gift card minimum is $5.");
      return;
    }

    if (amountNum > currentBalance) {
      alert("Insufficient balance.");
      return;
    }

    try {
      await addDoc(collection(db, "cashout_requests"), {
        userId: user.uid,
        method: "giftcard",
        giftcardType: selectedGift.id,
        giftcardName: selectedGift.name,
        giftcardEmail: giftcardEmail,
        amount: amountNum,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Deduct balance
      const uRef = doc(db, "users", user.uid);
      const fresh = await getDoc(uRef);
      const bal = fresh.data()?.balance ?? 0;

      if (bal < amountNum) {
        alert("Balance changed - insufficient funds.");
        return;
      }

      await updateDoc(uRef, { balance: bal - amountNum });

      setCurrentBalance(bal - amountNum);
      await refreshProfile();

      alert("Gift card request submitted!");
      setShowGiftModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to submit gift card request.");
    }
  };

  /* ---------------------------------------------------
     DONATIONS (unchanged)
--------------------------------------------------- */
  const selectedCharity =
    selectedCharityId != null
      ? charities.find((c) => c.id === selectedCharityId) || null
      : null;

  const openDonationModal = (charityId: string) => {
    setSelectedCharityId(charityId);
    setDonationAmount("");
    setDonationEmail(user.email || "");
    setShowDonationModal(true);
  };

  const handleSubmitDonation = async () => {
    if (!selectedCharity) return;

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
      const bal = fresh.data()?.balance ?? 0;

      if (bal < amountNum) {
        alert("Balance changed - insufficient funds.");
        return;
      }

      await updateDoc(uRef, { balance: bal - amountNum });
      setCurrentBalance(bal - amountNum);
      await refreshProfile();

      alert("Donation submitted!");
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
  return (
    <main className="rb-content rewards-shell">
      {/* HERO */}
      <section className="rw-card rw-card-hero">
        <h2 className="rb-section-title">Cash Out Your Earnings 💰</h2>
        <p className="rb-section-sub">
          Choose a payout method, gift card, or donate with a 5% ReadyBread match.
        </p>
        <div className="rw-balance-line">
          <span>Your balance:</span>
          <strong>${currentBalance.toFixed(2)}</strong>
        </div>
      </section>

      {/* MOBILE PAYOUTS */}
      <section className="rw-card">
        <h3>Mobile Banking 🏦</h3>
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
                  <p>{m.blurb}</p>
                </div>
                <img src={m.logo} className="rw-pill-logo" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* GIFT CARDS */}
      <section className="rw-card">
        <h3>Gift Cards 🎁</h3>
        <div className="rw-row-strip">
          {giftCardPayoutMethods.map((m) => (
            <button
              key={m.id}
              className={`rw-pill-card ${m.brandClass}`}
              onClick={() => openPayoutModal("giftcard")}
            >
              <div className="rw-pill-main">
                <div className="rw-pill-text">
                  <h4>{m.name}</h4>
                  <p>{m.headline}</p>
                  <p>{m.blurb}</p>
                </div>
                <img src={m.logo} className="rw-pill-logo" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* CRYPTO */}
      <section className="rw-card">
        <h3>Crypto</h3>
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
                  <p>{m.headline}</p>
                  <p>{m.blurb}</p>
                </div>
                <img src={m.logo} className="rw-pill-logo" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* DONATIONS */}
      <section className="rw-card">
        <h3>Donations (We match 5%) 🤝</h3>
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
                  <p>{c.blurb}</p>
                </div>
                <img src={c.logo} className="rw-pill-logo" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* RULES */}
      <section className="rw-card">
        <h3 className="accent-toast">Cashout Rules</h3>
        <ul className="rw-rules">
          <li>Minimum cashout: $3</li>
          <li>Gift cards: minimum $5 (Spotify fixed at $10)</li>
          <li>Maximum per request: $20</li>
          <li>1 cashout per 24 hours</li>
          <li>Crypto: 10% network fee</li>
        </ul>
      </section>

      {/* PAYOUT MODAL */}
      {showPayoutModal && selectedMethodId && selectedMethodId !== "giftcard" && (
        <div className="rb-modal">
          <div
            className="rb-modal-backdrop"
            onClick={() => setShowPayoutModal(false)}
          />
          <div className="rb-modal-content">
            <h3>Cash Out via {selectedMethodId.toUpperCase()}</h3>

            <label>Amount ($3 - $20)</label>
            <input
              type="number"
              value={payoutAmount}
              min={3}
              max={Math.min(20, currentBalance)}
              onChange={(e) => setPayoutAmount(e.target.value)}
            />

            <label>
              {selectedMethodId === "paypal"
                ? "PayPal Email"
                : selectedMethodId === "cashapp"
                  ? "Cash App $cashtag"
                  : selectedMethodId === "venmo"
                    ? "Venmo Username"
                    : "Bitcoin Address"}
            </label>

            <input
              type="text"
              value={payoutIdentifier}
              onChange={(e) => setPayoutIdentifier(e.target.value)}
            />

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

      {/* GIFT CARD MODAL */}
      {showGiftModal && (
        <div className="rb-modal">
          <div className="rb-modal-backdrop" onClick={() => setShowGiftModal(false)} />
          <div className="rb-modal-content">
            <h3>Choose a Gift Card</h3>

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
                <h4>Select Amount</h4>
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

                <label>Gift Card Delivery Email</label>
                <input
                  type="email"
                  value={giftcardEmail}
                  onChange={(e) => setGiftcardEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </>
            )}

            <div className="rb-modal-actions">
              <button className="hb-btn" onClick={handleGiftCardSubmit}>
                Submit Request
              </button>
              <button className="secondary-btn" onClick={() => setShowGiftModal(false)}>
                Cancel
              </button>
            </div>
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
            <h3>Donate to {selectedCharity.name}</h3>

            <label>Amount</label>
            <input
              type="number"
              min={0.5}
              step="0.01"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
            />

            <p>
              ReadyBread match: <b>${matchAmount.toFixed(2)}</b>
            </p>

            <label>Receipt Email (optional)</label>
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
