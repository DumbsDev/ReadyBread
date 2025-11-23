// src/pages/Dashboard.tsx
// Dashboard using global UserContext instead of local Firebase state

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { useUser } from "../contexts/UserContext";

// -------------------------------
// Types (unchanged)
// -------------------------------
interface OfferGoal {
  id?: string;
  label: string;
  payout?: number;
  isCompleted?: boolean;
}

interface StartedOffer {
  id: string;
  title?: string;
  totalPayout?: number;
  estMinutes?: number | null;
  imageUrl?: string | null;
  clickUrl?: string;
  source?: string;
  type?: string;
  status?: string;
  startedAt?: any;
  completedAt?: any;
  lastUpdatedAt?: any;
  totalObjectives?: number;
  completedObjectives?: number;
  goals?: OfferGoal[];
}

interface ReferralDoc {
  referredUserId?: string;
  joinedAt?: any;
  earningsFromReferral?: number;
  blockedReason?: string | null;
}

interface ReferralRow {
  referredUserId: string;
  username?: string | null;
  joinedAt?: any;
  earningsFromReferral: number;
  blockedReason?: string | null;
}

interface OfferHistoryItem {
  id: string;
  offerId?: string;
  type?: string;
  amount?: number;
  createdAt?: any;
  source?: string | null;
}

// -------------------------------
// Component
// -------------------------------
export const Dashboard: React.FC = () => {
  // NEW: global user context
  const { user, profile, balance, loading } = useUser();

  // Everything else stays the same ↓
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "overview" | "stats" | "offers" | "payouts" | "achievements"
  >("overview");

  const [allOffers, setAllOffers] = useState<StartedOffer[]>([]);
  const [activeOffers, setActiveOffers] = useState<StartedOffer[]>([]);
  const [completedOffers, setCompletedOffers] = useState<StartedOffer[]>([]);
  const [progressOffers, setProgressOffers] = useState<StartedOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);

  const [offerHistory, setOfferHistory] = useState<OfferHistoryItem[]>([]);
  const [offerHistoryLoading, setOfferHistoryLoading] = useState(true);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStatsLoading, setReferralStatsLoading] = useState(true);
  const [referralCount, setReferralCount] = useState(0);
  const [referralEarnings, setReferralEarnings] = useState(0);

  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [referralSuccessCount, setReferralSuccessCount] = useState(0);
  const [referralBlockedCount, setReferralBlockedCount] = useState(0);
  const [referralPendingCount, setReferralPendingCount] = useState(0);

  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);

  const [referrerName, setReferrerName] = useState<string | null>(null);

  const [selectedOffer, setSelectedOffer] = useState<StartedOffer | null>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

  // ----------------------------------------------------
  // LOAD EVERYTHING (NOW DRIVEN BY user?.uid)
  // ----------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const loadEverything = async () => {
      try {
        const uid = user.uid;

        // Load profile from context (still fetch extra referral+stats + offers)
        await loadReferralData(uid);
        await loadStartedOffers(uid);
        await loadOfferHistory(uid);
        await loadPayoutHistory(uid);
      } catch (err) {
        console.error(err);
        setError("Something went wrong loading your dashboard.");
      }
    };

    loadEverything();
  }, [user]);

  // ----------------------------------------------------
  // LOAD REFERRALS (unchanged)
  // ----------------------------------------------------
  const loadReferralData = async (uid: string) => {
    setReferralStatsLoading(true);

    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return;

      const userData = snap.data();
      let code = userData.referralCode;

      if (!code) {
        code = uid.slice(-6).toUpperCase();
        await setDoc(userRef, { referralCode: code }, { merge: true });
      }

      setReferralCode(code);

      // Fetch referrer username
      if (userData.referredBy) {
        const qRef = query(
          collection(db, "users"),
          where("referralCode", "==", userData.referredBy)
        );
        const rSnap = await getDocs(qRef);
        if (!rSnap.empty) {
          const refData = rSnap.docs[0].data();
          setReferrerName(refData.username || null);
        }
      }

      // Load referral list
      const refCol = collection(db, "users", uid, "referrals");
      const refSnap = await getDocs(refCol);

      const list = refSnap.docs.map((d) => d.data() as ReferralDoc);
      setReferralCount(list.length);

      const earned = list.reduce(
        (sum, r) => sum + (r.earningsFromReferral ?? 0),
        0
      );
      setReferralEarnings(earned);

      let success = 0,
        blocked = 0,
        pending = 0;

      list.forEach((r) => {
        const earned = r.earningsFromReferral ?? 0;
        if (r.blockedReason) blocked++;
        else if (earned > 0) success++;
        else pending++;
      });

      setReferralSuccessCount(success);
      setReferralBlockedCount(blocked);
      setReferralPendingCount(pending);

      // Build referral rows
      const rows: ReferralRow[] = [];
      await Promise.all(
        list.map(async (r) => {
          if (!r.referredUserId) return;

          const referredUserRef = doc(db, "users", r.referredUserId);
          const ruSnap = await getDoc(referredUserRef);

          let username = null;
          if (ruSnap.exists()) {
            username = (ruSnap.data() as any).username ?? null;
          }

          rows.push({
            referredUserId: r.referredUserId,
            username,
            joinedAt: r.joinedAt,
            earningsFromReferral: r.earningsFromReferral ?? 0,
            blockedReason: r.blockedReason ?? null,
          });
        })
      );

      rows.sort((a, b) => {
        const aTime = a.joinedAt?.toDate
          ? a.joinedAt.toDate().getTime()
          : 0;
        const bTime = b.joinedAt?.toDate
          ? b.joinedAt.toDate().getTime()
          : 0;
        return bTime - aTime;
      });

      setReferrals(rows);
    } finally {
      setReferralStatsLoading(false);
    }
  };

  // ----------------------------------------------------
  // LOAD OFFERS (unchanged)
  // ----------------------------------------------------
  const loadStartedOffers = async (uid: string) => {
    setOffersLoading(true);

    try {
      const colRef = collection(db, "users", uid, "startedOffers");
      const q = query(colRef, orderBy("startedAt", "desc"));
      const snap = await getDocs(q);

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setAllOffers(items);
      setActiveOffers(items.filter((o) => o.status !== "completed"));
      setCompletedOffers(items.filter((o) => o.status === "completed"));
      setProgressOffers(
        items.filter(
          (o) => typeof o.totalObjectives === "number" && o.totalObjectives > 0
        )
      );
    } finally {
      setOffersLoading(false);
    }
  };

  const loadOfferHistory = async (uid: string) => {
    setOfferHistoryLoading(true);

    try {
      const colRef = collection(db, "users", uid, "offers");
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      setOfferHistory(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    } finally {
      setOfferHistoryLoading(false);
    }
  };

  const loadPayoutHistory = async (uid: string) => {
    setPayoutsLoading(true);

    try {
      const colRef = collection(db, "users", uid, "cashouts");
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      setPayouts(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } finally {
      setPayoutsLoading(false);
    }
  };

  // ----------------------------------------------------
  // MODAL + HELPERS + UI (UNCHANGED)
  // ----------------------------------------------------
  const formatTimestamp = (ts: any) =>
    ts?.toDate ? ts.toDate().toLocaleDateString() : "—";

  const openOfferModal = (offer: StartedOffer) => {
    setSelectedOffer(offer);
    setIsOfferModalOpen(true);
  };

  const closeOfferModal = () => {
    setSelectedOffer(null);
    setIsOfferModalOpen(false);
  };

  const handleCopyReferralLink = () => {
    if (!referralCode) return alert("Referral link unavailable");

    const link = `${window.location.origin}/login?ref=${referralCode}`;
    navigator.clipboard?.writeText(link);
    alert("Copied!");
  };

  // ----------------------------------------------------
  // AUTH GUARD USING CONTEXT
  // ----------------------------------------------------
  if (!user && !loading) {
    return (
      <main className="rb-content">
        <div className="dash-card modern-card">
          <h2>Please log in to access your Dashboard.</h2>
          <Link className="rb-link" to="/login">
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  if (loading || !profile) {
    return (
      <main className="rb-content">
        <div className="dash-card modern-card">
          <p className="dash-muted">Loading your dashboard…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="rb-content">
        <div className="dash-card modern-card">
          <p className="dash-muted">{error}</p>
        </div>
      </main>
    );
  }

  // ----------------------------------------------------
  // ORIGINAL FULL DASHBOARD UI (UNCHANGED)
  // ----------------------------------------------------
  // (Same as your current UI — tabs, overview, stats, offers, payouts, achievements, modal)
  // To keep this message short, I’ll include the full UI in the next message.
  // Nothing is removed or altered — only references changed to use context.

return (
  <main className="rb-content">
    <section className="dash-shell">
      <h2 className="rb-section-title">Your Dashboard</h2>
      <p className="rb-section-sub">
        Welcome back, {profile?.username ?? "user"} 👋
      </p>

      {/* Tabs */}
      <div className="dash-tabs">
        <button
          className={`dash-tab-btn ${
            activeTab === "overview" ? "dash-tab-active" : ""
          }`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>

        <button
          className={`dash-tab-btn ${
            activeTab === "stats" ? "dash-tab-active" : ""
          }`}
          onClick={() => setActiveTab("stats")}
        >
          Stats
        </button>

        <button
          className={`dash-tab-btn ${
            activeTab === "offers" ? "dash-tab-active" : ""
          }`}
          onClick={() => setActiveTab("offers")}
        >
          Offers
        </button>

        <button
          className={`dash-tab-btn ${
            activeTab === "payouts" ? "dash-tab-active" : ""
          }`}
          onClick={() => setActiveTab("payouts")}
        >
          Payout History
        </button>

        <button
          className={`dash-tab-btn ${
            activeTab === "achievements" ? "dash-tab-active" : ""
          }`}
          onClick={() => setActiveTab("achievements")}
        >
          Achievements
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="dash-panel dash-panel-active">
          {/* ACCOUNT SUMMARY */}
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Account Summary</h3>

            <p className="dash-line">
              <span className="dash-label">Username:</span>
              <span>{profile?.username}</span>
            </p>

            <p className="dash-line">
              <span className="dash-label">Email:</span>
              <span>{profile?.email ?? user?.email ?? "Unknown"}</span>
            </p>

            {referrerName && (
              <p className="dash-line">
                <span className="dash-label">Referred By:</span>{" "}
                <span>{referrerName}</span>
              </p>
            )}

            <p className="dash-line">
              <span className="dash-label">Current Balance:</span>
              <span className="dash-balance">${balance.toFixed(2)}</span>
            </p>
          </div>

          {/* REFERRALS */}
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Referrals</h3>

            {referralStatsLoading ? (
              <p className="dash-muted">Loading referral stats…</p>
            ) : (
              <>
                <p className="dash-line">
                  <span className="dash-label">Your Code:</span>{" "}
                  <span className="dash-ref-code">{referralCode}</span>
                </p>

                <p className="dash-line">
                  <span className="dash-label">Your Link:</span>{" "}
                  <span className="dash-ref-link">
                    {typeof window !== "undefined" && referralCode
                      ? `${window.location.origin}/login?ref=${referralCode}`
                      : ""}
                  </span>
                </p>

                <button
                  className="dash-offer-btn"
                  style={{ marginTop: 6, marginBottom: 12 }}
                  onClick={handleCopyReferralLink}
                >
                  Copy Referral Link
                </button>

                {/* Quick stats */}
                <div className="dash-ref-summary">
                  <p className="dash-line">
                    <span className="dash-label">Total Signups:</span>{" "}
                    <span>{referralCount}</span>
                  </p>
                  <p className="dash-line">
                    <span className="dash-label">Completed / Paid:</span>{" "}
                    <span>{referralSuccessCount}</span>
                  </p>
                  <p className="dash-line">
                    <span className="dash-label">Pending:</span>{" "}
                    <span>{referralPendingCount}</span>
                  </p>
                  <p className="dash-line">
                    <span className="dash-label">Blocked / Invalid:</span>{" "}
                    <span>{referralBlockedCount}</span>
                  </p>
                  <p className="dash-line">
                    <span className="dash-label">Earned From Referrals:</span>{" "}
                    <span>${referralEarnings.toFixed(2)}</span>
                  </p>
                </div>

                {/* Referral list */}
                {referrals.length === 0 ? (
                  <p className="dash-muted" style={{ marginTop: 10 }}>
                    No referrals yet — share your link!
                  </p>
                ) : (
                  <div className="dash-referral-list" style={{ marginTop: 12 }}>
                    {referrals.map((r) => {
                      const earned = r.earningsFromReferral ?? 0;
                      const blocked = !!r.blockedReason;
                      const statusLabel = blocked
                        ? "Blocked"
                        : earned > 0
                        ? "Paid"
                        : "Pending";

                      return (
                        <div
                          key={r.referredUserId}
                          className="dash-offer-row glass-row"
                        >
                          <div className="dash-offer-info">
                            <h4 className="dash-offer-title">
                              {r.username || r.referredUserId}
                            </h4>
                            <p className="dash-offer-meta">
                              Joined: {formatTimestamp(r.joinedAt)}
                            </p>
                            <p className="dash-offer-meta">
                              Earned: ${earned.toFixed(2)}
                            </p>
                            <p className="dash-offer-meta">
                              Status: {statusLabel}
                              {blocked && r.blockedReason
                                ? ` (${r.blockedReason})`
                                : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="dash-muted dash-footnote">
                  Share your link — earn from friends and teammates.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {activeTab === "stats" && (
        <div className="dash-panel dash-panel-active">
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Your Stats</h3>

            <p className="dash-line">
              <span className="dash-label">Balance:</span>{" "}
              <span>${balance.toFixed(2)}</span>
            </p>

            <p className="dash-line">
              <span className="dash-label">Total Offers Started:</span>{" "}
              <span>{allOffers.length}</span>
            </p>

            <p className="dash-line">
              <span className="dash-label">Total Offers Completed:</span>{" "}
              <span>{completedOffers.length}</span>
            </p>

            <p className="dash-line">
              <span className="dash-label">Total Payout Requests:</span>{" "}
              <span>{payouts.length}</span>
            </p>

            <p className="dash-line">
              <span className="dash-label">Total Referrals:</span>{" "}
              <span>{referralCount}</span>
            </p>

            <p className="dash-line">
              <span className="dash-label">Earned From Referrals:</span>{" "}
              <span>${referralEarnings.toFixed(2)}</span>
            </p>

            <p className="dash-muted dash-footnote">
              More stats coming soon.
            </p>
          </div>
        </div>
      )}

      {/* OFFERS TAB */}
      {activeTab === "offers" && (
        <div className="dash-panel dash-panel-active">
          {/* ACTIVE OFFERS */}
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Active Offers</h3>

            {offersLoading ? (
              <p className="dash-muted">Loading…</p>
            ) : activeOffers.length === 0 ? (
              <p className="dash-muted">No active offers.</p>
            ) : (
              <div className="dash-offer-list">
                {activeOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="dash-offer-row dash-offer-row-clickable glass-row"
                    onClick={() => openOfferModal(offer)}
                  >
                    <div className="dash-offer-info">
                      <h4 className="dash-offer-title">
                        {offer.title ?? "Offer"}
                      </h4>
                      <p className="dash-offer-meta">
                        Started: {formatTimestamp(offer.startedAt)}
                      </p>
                      <p className="dash-offer-meta">
                        Payout: ${offer.totalPayout?.toFixed(2)}
                      </p>
                      <p className="dash-offer-meta">
                        Status: {offer.status ?? "started"}
                      </p>
                    </div>

                    <div className="dash-offer-actions">
                      {offer.clickUrl && (
                        <button
                          className="dash-offer-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(offer.clickUrl, "_blank");
                          }}
                        >
                          Open Offer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMPLETED OFFERS */}
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Completed Offers</h3>

            {offersLoading ? (
              <p className="dash-muted">Loading…</p>
            ) : completedOffers.length === 0 ? (
              <p className="dash-muted">No completed offers.</p>
            ) : (
              <div className="dash-offer-list">
                {completedOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="dash-offer-row dash-offer-row-clickable glass-row"
                    onClick={() => openOfferModal(offer)}
                  >
                    <div className="dash-offer-info">
                      <h4 className="dash-offer-title">
                        {offer.title ?? "Completed offer"}
                      </h4>
                      <p className="dash-offer-meta">
                        Completed:{" "}
                        {formatTimestamp(
                          offer.completedAt ?? offer.lastUpdatedAt
                        )}
                      </p>
                      <p className="dash-offer-meta">
                        Earned: ${offer.totalPayout?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="dash-muted dash-footnote">
              Completed offers automatically clean themselves after ~24h.
            </p>
          </div>

          {/* PROGRESS OFFERS */}
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Offer Progress</h3>

            {offersLoading ? (
              <p className="dash-muted">Loading…</p>
            ) : progressOffers.length === 0 ? (
              <p className="dash-muted">No milestone offers yet.</p>
            ) : (
              <div className="dash-offer-progress-list">
                {progressOffers.map((offer) => {
                  const total = offer.totalObjectives ?? 0;
                  const done = offer.completedObjectives ?? 0;
                  const pct =
                    total > 0
                      ? Math.min(100, Math.round((done / total) * 100))
                      : 0;

                  return (
                    <div
                      key={offer.id}
                      className="dash-progress-row dash-offer-row-clickable glass-row"
                      onClick={() => openOfferModal(offer)}
                    >
                      <div className="dash-offer-info">
                        <h4 className="dash-offer-title">
                          {offer.title ?? "Offer"}
                        </h4>
                        <p className="dash-offer-meta">
                          Milestones: {done}/{total} ({pct}%)
                        </p>
                      </div>
                      <div className="dash-progress-bar-wrap">
                        <div
                          className="dash-progress-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* OFFER HISTORY */}
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Offer Earnings History</h3>

            {offerHistoryLoading ? (
              <p className="dash-muted">Loading…</p>
            ) : offerHistory.length === 0 ? (
              <p className="dash-muted">No credited offers yet.</p>
            ) : (
              <div className="dash-offer-list">
                {offerHistory.map((item) => (
                  <div key={item.id} className="dash-offer-row glass-row">
                    <div className="dash-offer-info">
                      <h4 className="dash-offer-title">
                        {item.offerId ?? "Offer"}
                      </h4>
                      <p className="dash-offer-meta">
                        Type: {item.type ?? "offer"}
                        {item.source ? ` · Source: ${item.source}` : ""}
                      </p>
                      <p className="dash-offer-meta">
                        Earned: ${item.amount?.toFixed(2)}
                      </p>
                      <p className="dash-offer-meta">
                        Credited: {formatTimestamp(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="dash-muted dash-footnote">
              Includes game, survey, and bonus payouts.
            </p>
          </div>
        </div>
      )}

      {/* PAYOUTS TAB */}
      {activeTab === "payouts" && (
        <div className="dash-panel dash-panel-active">
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Payout History</h3>

            {payoutsLoading ? (
              <p className="dash-muted">Loading…</p>
            ) : payouts.length === 0 ? (
              <p className="dash-muted">No payout requests yet.</p>
            ) : (
              <div className="dash-payout-list">
                {payouts.map((p) => (
                  <div key={p.id} className="dash-payout-row glass-row">
                    <p className="dash-line">
                      <span className="dash-label">Amount:</span> $
                      {p.amount?.toFixed(2)}
                    </p>
                    <p className="dash-line">
                      <span className="dash-label">Status:</span> {p.status}
                    </p>
                    <p className="dash-line">
                      <span className="dash-label">Requested:</span>{" "}
                      {formatTimestamp(p.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <p className="dash-muted dash-footnote">
              Cashouts are processed manually.
            </p>
          </div>
        </div>
      )}

      {/* ACHIEVEMENTS TAB */}
      {activeTab === "achievements" && (
        <div className="dash-panel dash-panel-active">
          <div className="dash-card modern-card glass-card">
            <h3 className="dash-card-title">Achievements</h3>
            <p className="dash-muted">
              Sorry! This tab is currently <i>half-baked</i>. 🍞
            </p>
          </div>
        </div>
      )}

      {/* OFFER DETAIL MODAL */}
      {isOfferModalOpen && (
        <div
          className="dash-offer-modal-backdrop"
          onClick={closeOfferModal}
        >
          <div
            className="dash-offer-modal-wrapper"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedOffer && (
              <>
                {/* HEADER */}
                <div className="dash-offer-modal glass-card">
                  <header className="dash-offer-modal-header">
                    <div>
                      <h3 className="dash-card-title">
                        {selectedOffer.title ?? "Offer details"}
                      </h3>
                      <p className="dash-offer-meta">
                        Type: {selectedOffer.type ?? "offer"}
                        {selectedOffer.source
                          ? ` · Source: ${selectedOffer.source}`
                          : ""}
                      </p>
                    </div>
                    <button
                      className="dash-offer-modal-close"
                      onClick={closeOfferModal}
                      aria-label="Close details"
                    >
                      ✕
                    </button>
                  </header>

                  {/* BODY */}
                  <div className="dash-offer-modal-body">
                    <div className="dash-offer-modal-summary">
                      <p className="dash-line">
                        <span className="dash-label">Payout:</span>
                        <span>
                          ${selectedOffer.totalPayout?.toFixed(2) ?? "0.00"}
                        </span>
                      </p>
                      <p className="dash-line">
                        <span className="dash-label">Status:</span>
                        <span>{selectedOffer.status ?? "started"}</span>
                      </p>
                      <p className="dash-line">
                        <span className="dash-label">Started:</span>
                        <span>{formatTimestamp(selectedOffer.startedAt)}</span>
                      </p>
                      {selectedOffer.completedAt && (
                        <p className="dash-line">
                          <span className="dash-label">Completed:</span>
                          <span>
                            {formatTimestamp(selectedOffer.completedAt)}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* GOALS */}
                    <div className="dash-offer-modal-goals">
                      {/* completed column */}
                      <div className="dash-offer-modal-column">
                        <h4 className="dash-offer-modal-subtitle">
                          Completed
                        </h4>
                        {selectedOffer.goals &&
                        selectedOffer.goals.some((g) => g.isCompleted) ? (
                          <ul className="dash-goal-list">
                            {selectedOffer.goals
                              .filter((g) => g.isCompleted)
                              .map((g, i) => (
                                <li
                                  key={g.id ?? `goal-done-${i}`}
                                  className="dash-goal-item"
                                >
                                  <span className="dash-goal-pill dash-goal-pill-done">
                                    ✓
                                  </span>
                                  <div className="dash-goal-text-wrap">
                                    <span className="dash-goal-label">
                                      {g.label}
                                    </span>
                                    {g.payout !== undefined && (
                                      <span className="dash-goal-payout">
                                        +${g.payout.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <p className="dash-muted">Nothing completed yet.</p>
                        )}
                      </div>

                      {/* pending column */}
                      <div className="dash-offer-modal-column">
                        <h4 className="dash-offer-modal-subtitle">
                          In Progress
                        </h4>

                        {selectedOffer.goals &&
                        selectedOffer.goals.some((g) => !g.isCompleted) ? (
                          <ul className="dash-goal-list">
                            {selectedOffer.goals
                              .filter((g) => !g.isCompleted)
                              .map((g, i) => (
                                <li
                                  key={g.id ?? `goal-todo-${i}`}
                                  className="dash-goal-item dash-goal-item-pending"
                                >
                                  <span className="dash-goal-pill">•</span>
                                  <div className="dash-goal-text-wrap">
                                    <span className="dash-goal-label">
                                      {g.label}
                                    </span>
                                    {g.payout !== undefined && (
                                      <span className="dash-goal-payout">
                                        +${g.payout.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <p className="dash-muted">No remaining goals.</p>
                        )}
                      </div>
                    </div>

                    {selectedOffer.clickUrl && (
                      <div className="dash-offer-modal-footer">
                        <button
                          className="dash-offer-btn"
                          onClick={() =>
                            window.open(selectedOffer.clickUrl!, "_blank")
                          }
                        >
                          Return to Offer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  </main>
);
};