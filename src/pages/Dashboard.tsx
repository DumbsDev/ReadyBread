// src/pages/Dashboard.tsx
// Dashboard with Overview, Stats, Offers, Payout History, Achievements,
// plus Active Offers, Completed Offers, Progress, Referral System,
// and Offer Earnings History (game + surveys).

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { auth, db } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";

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

// Optional goals / milestones for an offer
interface OfferGoal {
  id?: string;
  label: string;
  payout?: number;
  isCompleted?: boolean;
}

// Started offers (progress + goals)
interface StartedOffer {
  id: string;
  title?: string;
  totalPayout?: number;
  estMinutes?: number | null;
  imageUrl?: string | null;
  clickUrl?: string;
  source?: string;
  type?: string; // "game" | "survey" | "offer" | etc.
  status?: string; // "started" | "in-progress" | "completed"
  startedAt?: any;
  completedAt?: any;
  lastUpdatedAt?: any;
  totalObjectives?: number;
  completedObjectives?: number;
  goals?: OfferGoal[]; // optional milestones from BitLabs / other vendors
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

// History of credited offers (game, survey, etc.)
interface OfferHistoryItem {
  id: string;
  offerId?: string;
  type?: string; // "game" | "survey" | "receipt" | etc.
  amount?: number;
  createdAt?: any;
  source?: string | null;
}

export const Dashboard: React.FC = () => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "overview" | "stats" | "offers" | "payouts" | "achievements"
  >("overview");

  // User balance
  const [balanceNumber, setBalanceNumber] = useState(0);

  // Offers (live / startedOffers)
  const [allOffers, setAllOffers] = useState<StartedOffer[]>([]);
  const [activeOffers, setActiveOffers] = useState<StartedOffer[]>([]);
  const [completedOffers, setCompletedOffers] = useState<StartedOffer[]>([]);
  const [progressOffers, setProgressOffers] = useState<StartedOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);

  // Offer earnings history (from users/{uid}/offers)
  const [offerHistory, setOfferHistory] = useState<OfferHistoryItem[]>([]);
  const [offerHistoryLoading, setOfferHistoryLoading] = useState(true);

  // Referrals
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStatsLoading, setReferralStatsLoading] = useState(true);
  const [referralCount, setReferralCount] = useState(0);
  const [referralEarnings, setReferralEarnings] = useState(0);

  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [referralSuccessCount, setReferralSuccessCount] = useState(0);
  const [referralBlockedCount, setReferralBlockedCount] = useState(0);
  const [referralPendingCount, setReferralPendingCount] = useState(0);

  // Payout history
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);

  const [referrerName, setReferrerName] = useState<string | null>(null);

  // NEW: modal state for offer details
  const [selectedOffer, setSelectedOffer] = useState<StartedOffer | null>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

  // ----------------------------------------------------
  // AUTH LISTENER
  // ----------------------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsub();
  }, []);

  // ----------------------------------------------------
  // LOAD EVERYTHING
  // ----------------------------------------------------
  useEffect(() => {
    const loadEverything = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        // Load profile
        const profileRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(profileRef);

        if (!snap.exists()) {
          setError("Your profile could not be found.");
          setLoading(false);
          return;
        }

        const data = snap.data();
        setProfile(data);
        setBalanceNumber(data.balance ?? 0);

        await loadReferralData(firebaseUser.uid);
        await loadStartedOffers(firebaseUser.uid);
        await loadOfferHistory(firebaseUser.uid);
        await loadPayoutHistory(firebaseUser.uid);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Something went wrong loading your dashboard.");
        setLoading(false);
      }
    };

    loadEverything();
  }, [firebaseUser]);

  // ----------------------------------------------------
  // LOAD REFERRAL DATA (CODE + STATS + LIST)
  // ----------------------------------------------------
  const loadReferralData = async (uid: string) => {
    setReferralStatsLoading(true);
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        setReferralStatsLoading(false);
        return;
      }

      const userData = snap.data();

      let code = userData.referralCode;

      // Generate referral code if none exists
      if (!code) {
        code = uid.slice(-6).toUpperCase();
        await setDoc(userRef, { referralCode: code }, { merge: true });
      }

      setReferralCode(code);

      // Fetch referrer username (who referred THIS user)
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

      // Load referral documents (who YOU referred)
      const refCol = collection(db, "users", uid, "referrals");
      const refSnap = await getDocs(refCol);

      const list: ReferralDoc[] = refSnap.docs.map((d) => d.data()) as any[];

      setReferralCount(list.length);

      const totalEarned = list.reduce(
        (sum, r) => sum + (r.earningsFromReferral ?? 0),
        0
      );
      setReferralEarnings(totalEarned);

      // Compute referral status counts
      let success = 0;
      let blocked = 0;
      let pending = 0;

      list.forEach((r) => {
        const earned = r.earningsFromReferral ?? 0;
        const blockedReason =
          (r as any).blockedReason !== undefined
            ? (r as any).blockedReason
            : null;

        if (blockedReason) {
          blocked += 1;
        } else if (earned > 0) {
          success += 1;
        } else {
          pending += 1;
        }
      });

      setReferralSuccessCount(success);
      setReferralBlockedCount(blocked);
      setReferralPendingCount(pending);

      // Build referral rows with usernames for display
      const rows: ReferralRow[] = [];
      await Promise.all(
        list.map(async (r) => {
          const referredUserId = r.referredUserId;
          if (!referredUserId) return;

          try {
            const referredUserRef = doc(db, "users", referredUserId);
            const ruSnap = await getDoc(referredUserRef);
            let username: string | null = null;
            if (ruSnap.exists()) {
              const ruData = ruSnap.data();
              username = (ruData as any).username ?? null;
            }

            rows.push({
              referredUserId,
              username,
              joinedAt: r.joinedAt,
              earningsFromReferral: r.earningsFromReferral ?? 0,
              blockedReason:
                (r as any).blockedReason !== undefined
                  ? (r as any).blockedReason
                  : null,
            });
          } catch (e) {
            console.error("Failed to load referred user profile:", e);
          }
        })
      );

      // Sort referrals by joined date (newest first) if available
      rows.sort((a, b) => {
        const aTime = a.joinedAt?.toDate ? a.joinedAt.toDate().getTime() : 0;
        const bTime = b.joinedAt?.toDate ? b.joinedAt.toDate().getTime() : 0;
        return bTime - aTime;
      });

      setReferrals(rows);
    } catch (err) {
      console.error("Referral loading error:", err);
    }
    setReferralStatsLoading(false);
  };

  // ----------------------------------------------------
  // LOAD STARTED + COMPLETED OFFERS (progress tracking)
  // ----------------------------------------------------
  const loadStartedOffers = async (uid: string) => {
    setOffersLoading(true);

    try {
      const colRef = collection(db, "users", uid, "startedOffers");
      const q = query(colRef, orderBy("startedAt", "desc"));
      const snap = await getDocs(q);

      const items: StartedOffer[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setAllOffers(items);

      setActiveOffers(
        items.filter((o) => (o.status ?? "started") !== "completed")
      );
      setCompletedOffers(items.filter((o) => o.status === "completed"));
      setProgressOffers(
        items.filter(
          (o) =>
            typeof o.totalObjectives === "number" && o.totalObjectives > 0
        )
      );
    } catch (err) {
      console.error("Failed to load offers:", err);
      setAllOffers([]);
      setActiveOffers([]);
      setCompletedOffers([]);
      setProgressOffers([]);
    }

    setOffersLoading(false);
  };

  // ----------------------------------------------------
  // LOAD OFFER EARNINGS HISTORY (all credited offers)
  // ----------------------------------------------------
  const loadOfferHistory = async (uid: string) => {
    setOfferHistoryLoading(true);

    try {
      const colRef = collection(db, "users", uid, "offers");
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const items: OfferHistoryItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setOfferHistory(items);
    } catch (err) {
      console.error("Error loading offer history:", err);
      setOfferHistory([]);
    }

    setOfferHistoryLoading(false);
  };

  // ----------------------------------------------------
  // LOAD PAYOUT HISTORY
  // ----------------------------------------------------
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
    } catch (err) {
      console.error("Error loading payout history:", err);
      setPayouts([]);
    }

    setPayoutsLoading(false);
  };

  // ----------------------------------------------------
  // COPY REFERRAL LINK
  // ----------------------------------------------------
  const handleCopyReferralLink = () => {
    if (!referralCode) {
      alert("Referral link not available yet.");
      return;
    }

    const link =
      typeof window !== "undefined"
        ? `${window.location.origin}/login?ref=${referralCode}`
        : "";

    if (!link) {
      alert("Referral link not available.");
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(link)
        .then(() => alert("Referral link copied to clipboard!"))
        .catch(() =>
          alert("Failed to copy automatically. Here is your link:\n" + link)
        );
    } else {
      try {
        alert("Copy this link:\n" + link);
      } catch {
        alert("Copy this link:\n" + link);
      }
    }
  };

  // ----------------------------------------------------
  // OFFER MODAL HELPERS
  // ----------------------------------------------------
  const openOfferModal = (offer: StartedOffer) => {
    setSelectedOffer(offer);
    setIsOfferModalOpen(true);
  };

  const closeOfferModal = () => {
    setSelectedOffer(null);
    setIsOfferModalOpen(false);
  };

  // ----------------------------------------------------
  // RENDER UNAUTHENTICATED / LOADING / ERROR
  // ----------------------------------------------------
  if (!firebaseUser) {
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

  if (loading) {
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
  // DATE FORMATTER
  // ----------------------------------------------------
  const formatTimestamp = (ts: any) => {
    if (ts?.toDate) return ts.toDate().toLocaleDateString();
    return "—";
  };

  // Simple derived stats
  const totalOffersStarted = allOffers.length;
  const totalOffersCompleted = completedOffers.length;
  const totalPayoutRequests = payouts.length;

  // ----------------------------------------------------
  // BUILD MODAL CONTENT FOR SELECTED OFFER
  // ----------------------------------------------------
  const renderOfferModalContent = () => {
    if (!selectedOffer) return null;

    const type = selectedOffer.type ?? "offer";
    const status = selectedOffer.status ?? "started";
    const goals = selectedOffer.goals ?? [];

    let completedGoals: OfferGoal[] = [];
    let inProgressGoals: OfferGoal[] = [];

    if (goals.length > 0) {
      // Generic multi-goal support for BitLabs, Lootably, AyeT, AdGem, OfferToro, etc.
      completedGoals = goals.filter((g) => g.isCompleted);
      inProgressGoals = goals.filter((g) => !g.isCompleted);
    } else if (type === "survey") {
      // Surveys: simple 2-step status
      completedGoals = [
        { label: "Survey started", isCompleted: true },
        ...(status === "completed"
          ? [{ label: "Survey finished", isCompleted: true }]
          : []),
      ];
      inProgressGoals =
        status === "completed"
          ? []
          : [{ label: "Survey finished", isCompleted: false }];
    } else {
      // Generic game / offer fallback when we have no goals
      completedGoals =
        status === "completed"
          ? [{ label: "Main objective completed", isCompleted: true }]
          : [];
      inProgressGoals =
        status === "completed"
          ? []
          : [{ label: "Objectives still in progress", isCompleted: false }];
    }

    return (
      <div className="dash-offer-modal glass-card">
        <header className="dash-offer-modal-header">
          <div>
            <h3 className="dash-card-title">
              {selectedOffer.title ?? "Offer details"}
            </h3>
            <p className="dash-offer-meta">
              Type: {type}
              {selectedOffer.source ? ` · Source: ${selectedOffer.source}` : ""}
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

        <div className="dash-offer-modal-body">
          <div className="dash-offer-modal-summary">
            <p className="dash-line">
              <span className="dash-label">Payout:</span>{" "}
              <span>${selectedOffer.totalPayout?.toFixed(2) ?? "0.00"}</span>
            </p>
            <p className="dash-line">
              <span className="dash-label">Status:</span>{" "}
              <span>{status}</span>
            </p>
            <p className="dash-line">
              <span className="dash-label">Started:</span>{" "}
              <span>{formatTimestamp(selectedOffer.startedAt)}</span>
            </p>
            {selectedOffer.completedAt && (
              <p className="dash-line">
                <span className="dash-label">Completed:</span>{" "}
                <span>{formatTimestamp(selectedOffer.completedAt)}</span>
              </p>
            )}
          </div>

          <div className="dash-offer-modal-goals">
            {/* Completed section */}
            <div className="dash-offer-modal-column">
              <h4 className="dash-offer-modal-subtitle">Completed</h4>
              {completedGoals.length === 0 ? (
                <p className="dash-muted">Nothing completed yet.</p>
              ) : (
                <ul className="dash-goal-list">
                  {completedGoals.map((g, idx) => (
                    <li key={g.id ?? `${idx}-done`} className="dash-goal-item">
                      <span className="dash-goal-pill dash-goal-pill-done">
                        ✓
                      </span>
                      <div className="dash-goal-text-wrap">
                        <span className="dash-goal-label">{g.label}</span>
                        {g.payout !== undefined && (
                          <span className="dash-goal-payout">
                            +${g.payout.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* In-progress section */}
            <div className="dash-offer-modal-column">
              <h4 className="dash-offer-modal-subtitle">In Progress</h4>
              {inProgressGoals.length === 0 ? (
                <p className="dash-muted">No remaining goals.</p>
              ) : (
                <ul className="dash-goal-list">
                  {inProgressGoals.map((g, idx) => (
                    <li
                      key={g.id ?? `${idx}-todo`}
                      className="dash-goal-item dash-goal-item-pending"
                    >
                      <span className="dash-goal-pill">•</span>
                      <div className="dash-goal-text-wrap">
                        <span className="dash-goal-label">{g.label}</span>
                        {g.payout !== undefined && (
                          <span className="dash-goal-payout">
                            +${g.payout.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {selectedOffer.clickUrl && (
            <div className="dash-offer-modal-footer">
              <button
                className="dash-offer-btn"
                onClick={() =>
                  window.open(selectedOffer.clickUrl as string, "_blank")
                }
              >
                Return to Offer
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // MAIN DASHBOARD VIEW
  // ----------------------------------------------------
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
                <span className="dash-label">Username:</span>{" "}
                <span>{profile?.username}</span>
              </p>

              <p className="dash-line">
                <span className="dash-label">Email:</span>{" "}
                <span>{profile?.email}</span>
              </p>

              {referrerName && (
                <p className="dash-line">
                  <span className="dash-label">Referred By:</span>{" "}
                  <span>{referrerName}</span>
                </p>
              )}

              <p className="dash-line">
                <span className="dash-label">Current Balance:</span>{" "}
                <span className="dash-balance">
                  ${balanceNumber.toFixed(2)}
                </span>
              </p>
            </div>

            {/* REFERRALS */}
            <div className="dash-card modern-card glass-card">
              <h3 className="dash-card-title">Referrals</h3>

              {referralStatsLoading ? (
                <p className="dash-muted">Loading referral stats…</p>
              ) : (
                <>
                  {/* Top row: code + link + copy */}
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
                    style={{ marginTop: "6px", marginBottom: "12px" }}
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
                      <span className="dash-label">
                        Earned From Referrals:
                      </span>{" "}
                      <span>${referralEarnings.toFixed(2)}</span>
                    </p>
                  </div>

                  {/* Referral list */}
                  {referrals.length === 0 ? (
                    <p className="dash-muted" style={{ marginTop: "10px" }}>
                      No referrals yet. Share your link to start earning from
                      friends, classmates, and teammates.
                    </p>
                  ) : (
                    <div
                      className="dash-referral-list"
                      style={{ marginTop: "12px" }}
                    >
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
                                Earned From This Referral: $
                                {earned.toFixed(2)}
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
                    Share your link — when someone signs up through your link
                    and verifies their email, you both earn real money.
                    Referrals may be limited per person to prevent abuse.
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
                <span className="dash-label">Current Balance:</span>{" "}
                <span>${balanceNumber.toFixed(2)}</span>
              </p>

              <p className="dash-line">
                <span className="dash-label">Total Offers Started:</span>{" "}
                <span>{totalOffersStarted}</span>
              </p>

              <p className="dash-line">
                <span className="dash-label">Total Offers Completed:</span>{" "}
                <span>{totalOffersCompleted}</span>
              </p>

              <p className="dash-line">
                <span className="dash-label">Total Payout Requests:</span>{" "}
                <span>{totalPayoutRequests}</span>
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
                More detailed graphs and breakdowns can be added here later
                (games vs surveys, daily streaks, and more).
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

              {offersLoading && (
                <p className="dash-muted">Loading your offers…</p>
              )}

              {!offersLoading && activeOffers.length === 0 && (
                <p className="dash-muted">You have no active offers.</p>
              )}

              {!offersLoading && activeOffers.length > 0 && (
                <div className="dash-offer-list">
                  {activeOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="dash-offer-row dash-offer-row-clickable glass-row"
                      onClick={() => openOfferModal(offer)}
                    >
                      <div className="dash-offer-info">
                        <h4 className="dash-offer-title">
                          {offer.title ?? "Unknown offer"}
                        </h4>
                        <p className="dash-offer-meta">
                          Started: {formatTimestamp(offer.startedAt)}
                        </p>
                        <p className="dash-offer-meta">
                          Payout: ${offer.totalPayout?.toFixed(2) ?? "0.00"}
                        </p>
                        <p className="dash-offer-meta">
                          Status: {offer.status ?? "started"}
                        </p>
                        {offer.source && (
                          <p className="dash-offer-meta">
                            Source: {offer.source}
                          </p>
                        )}
                      </div>

                      <div className="dash-offer-actions">
                        {offer.clickUrl && (
                          <button
                            className="dash-offer-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(offer.clickUrl as string, "_blank");
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

            {/* COMPLETED OFFERS (from startedOffers) */}
            <div className="dash-card modern-card glass-card">
              <h3 className="dash-card-title">Completed Offers</h3>

              {offersLoading && (
                <p className="dash-muted">Checking completed offers…</p>
              )}

              {!offersLoading && completedOffers.length === 0 && (
                <p className="dash-muted">
                  No completed offers yet — finish some games or surveys to see
                  them here.
                </p>
              )}

              {!offersLoading && completedOffers.length > 0 && (
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
                          Earned: ${offer.totalPayout?.toFixed(2) ?? "0.00"}
                        </p>
                        {offer.source && (
                          <p className="dash-offer-meta">
                            Source: {offer.source}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="dash-muted dash-footnote">
                Completed offers are auto-cleaned from this list about 24 hours
                after completion to keep your dashboard snappy.
              </p>
            </div>

            {/* OFFER PROGRESS (milestone-tracked) */}
            <div className="dash-card modern-card glass-card">
              <h3 className="dash-card-title">Offer Progress</h3>

              {offersLoading && (
                <p className="dash-muted">Loading progress…</p>
              )}

              {!offersLoading && progressOffers.length === 0 && (
                <p className="dash-muted">No milestone-tracked offers yet.</p>
              )}

              {!offersLoading && progressOffers.length > 0 && (
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

            {/* OFFER EARNINGS HISTORY (all sources & types) */}
            <div className="dash-card modern-card glass-card">
              <h3 className="dash-card-title">Offer Earnings History</h3>

              {offerHistoryLoading && (
                <p className="dash-muted">Loading offer earnings…</p>
              )}

              {!offerHistoryLoading && offerHistory.length === 0 && (
                <p className="dash-muted">
                  No credited offers yet. Complete games or surveys to see them
                  here.
                </p>
              )}

              {!offerHistoryLoading && offerHistory.length > 0 && (
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
                          Earned: ${item.amount?.toFixed(2) ?? "0.00"}
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
                This list includes all credited offers — game tasks and surveys.
              </p>
            </div>
          </div>
        )}

        {/* PAYOUTS TAB */}
        {activeTab === "payouts" && (
          <div className="dash-panel dash-panel-active">
            <div className="dash-card modern-card glass-card">
              <h3 className="dash-card-title">Payout History</h3>

              {payoutsLoading && (
                <p className="dash-muted">Loading payout history…</p>
              )}

              {!payoutsLoading && payouts.length === 0 && (
                <p className="dash-muted">No payout requests yet.</p>
              )}

              {!payoutsLoading && payouts.length > 0 && (
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
                Cashouts are processed manually by admin.
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
                Sorry! This tab is currently <i>half baked</i>. Please check
                back in at another time!
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
              {renderOfferModalContent()}
            </div>
          </div>
        )}
      </section>
    </main>
  );
};
