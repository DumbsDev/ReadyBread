// src/pages/Dashboard.tsx
// Dashboard using global UserContext instead of local Firebase state

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  limit,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { useUser } from "../contexts/UserContext";
import { getAuth, deleteUser } from "firebase/auth";
import { computeLevelProgress, estimateBaseXp } from "../utils/level";
import { computeQuestStats, getQuestWindows } from "../utils/questsMath";
import type { QuestStats, QuestWindows } from "../utils/questsMath";

// -------------------------------
// Types
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

const SHORTCUT_BONUS_ID = "shortcut_bonus";
const SHORTCUT_BONUS_AMOUNT = 0.05;
const SHORTCUT_BONUS_TITLE = "Home screen bonus";
const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

// -------------------------------
// Component
// -------------------------------
export const Dashboard: React.FC = () => {
  // Global user context
  const { user, profile, balance, loading } = useUser();

  const [error, setError] = useState<string | null>(null);
  const [desiredUsername, setDesiredUsername] = useState(
    profile?.username ?? ""
  );
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "overview" | "stats" | "offers" | "payouts" | "achievements"
  >("overview");
  const homeOffersEnabled = profile?.homeOffersEnabled === true;
  const [homeOffersSaving, setHomeOffersSaving] = useState(false);

  const auth = getAuth();
  const handleLogout = async () => {
  try {
  await auth.signOut();
  window.location.href = "/login";
  } catch (err) {
  console.error("Logout error", err);
  alert("Failed to log out. Try again.");
  }
  };


  const handleDeleteAccount = async () => {
  if (!window.confirm("Are you sure? This will permanently delete your account and all data.")) return;
  try {
  const u = auth.currentUser;
  if (!u) return alert("No user logged in.");
  await deleteUser(u);
  window.location.href = "/signup";
  } catch (err) {
  console.error("Delete error", err);
  alert("Failed to delete account. You may need to re-authenticate.");
  }
  };

  const handleHomeOffersToggle = async () => {
    if (!user) return;

    try {
      setHomeOffersSaving(true);
      await setDoc(
        doc(db, "users", user.uid),
        { homeOffersEnabled: !homeOffersEnabled },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to update home offers preference", err);
      alert("Could not update your start page preference. Try again.");
    } finally {
      setHomeOffersSaving(false);
    }
  };

  useEffect(() => {
    setDesiredUsername(profile?.username ?? "");
  }, [profile?.username]);

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
  const [questWindows, setQuestWindows] = useState<QuestWindows>(getQuestWindows());

  // ----------------------------------------------------
  // LOAD EVERYTHING (NOW DRIVEN BY user?.uid)
  // ----------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const loadEverything = async () => {
      try {
        const uid = user.uid;

        const results = await Promise.allSettled([
          loadReferralData(uid),
          loadStartedOffers(uid),
          loadOfferHistory(uid),
        ]);

        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length === results.length) {
          setError("Something went wrong loading your dashboard.");
        }
      } catch (err) {
        console.error(err);
        setError("Something went wrong loading your dashboard.");
      }
    };

    loadEverything();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsub = loadPayoutHistory(user.uid);
    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuestWindows(getQuestWindows());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // ----------------------------------------------------
  // LOAD REFERRALS (with better error handling)
  // ----------------------------------------------------
  const loadReferralData = async (uid: string) => {
    setReferralStatsLoading(true);

    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return;

      const userData = snap.data() as any;
      let code = userData.referralCode;

      if (!code) {
        code = uid.slice(-6).toUpperCase();
        await setDoc(userRef, { referralCode: code }, { merge: true });
      }

      setReferralCode(code);

      // Fetch referrer username (may hit other-user docs)
      if (userData.referredBy) {
        try {
          const qRef = query(
            collection(db, "users"),
            where("referralCode", "==", userData.referredBy)
          );
          const rSnap = await getDocs(qRef);
          if (!rSnap.empty) {
            const refData = rSnap.docs[0].data() as any;
            setReferrerName(refData.username || null);
          }
        } catch (err) {
          // If this fails due to security rules, just log & continue
          console.warn("Failed to load referrer user doc:", err);
        }
      }

      // Load referral list
      const refCol = collection(db, "users", uid, "referrals");
      const refSnap = await getDocs(refCol);

      const list = refSnap.docs.map((d) => d.data() as ReferralDoc);
      setReferralCount(list.length);

      const earnedTotal = list.reduce(
        (sum, r) => sum + (r.earningsFromReferral ?? 0),
        0
      );
      setReferralEarnings(earnedTotal);

      let success = 0;
      let blocked = 0;
      let pending = 0;

      list.forEach((r) => {
        const earned = r.earningsFromReferral ?? 0;
        if (r.blockedReason) blocked++;
        else if (earned > 0) success++;
        else pending++;
      });

      setReferralSuccessCount(success);
      setReferralBlockedCount(blocked);
      setReferralPendingCount(pending);

      // Build referral rows, but don't die if we can't read other-user docs
      const rows: ReferralRow[] = [];

      await Promise.all(
        list.map(async (r) => {
          if (!r.referredUserId) return;

          let username: string | null = null;

          try {
            const referredUserRef = doc(db, "users", r.referredUserId);
            const ruSnap = await getDoc(referredUserRef);
            if (ruSnap.exists()) {
              const data = ruSnap.data() as any;
              username = data.username ?? null;
            }
          } catch (err) {
            // Most likely a permission error when reading another user's doc
            console.warn("Failed to read referred user profile:", err);
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
    } catch (err) {
      console.error("Error loading referral data:", err);
      // Don't bubble this to kill the entire dashboard; just show partial data
    } finally {
      setReferralStatsLoading(false);
    }
  };

  const appendShortcutBonusToStartedOffers = (
    offers: StartedOffer[]
  ): StartedOffer[] => {
    if (!profile?.shortcutBonusClaimed) return offers;

    const hasBonus = offers.some((o) => o.id === SHORTCUT_BONUS_ID);
    if (hasBonus) return offers;

    const completedAt = profile?.shortcutBonusAt ?? null;

    const bonusOffer: StartedOffer = {
      id: SHORTCUT_BONUS_ID,
      title: SHORTCUT_BONUS_TITLE,
      totalPayout: SHORTCUT_BONUS_AMOUNT,
      type: "bonus",
      status: "completed",
      completedAt,
      lastUpdatedAt: completedAt ?? undefined,
      source: "pwa_shortcut",
    };

    return [bonusOffer, ...offers];
  };

  const appendShortcutBonusHistory = (
    items: OfferHistoryItem[]
  ): OfferHistoryItem[] => {
    if (!profile?.shortcutBonusClaimed) return items;

    const hasBonus = items.some(
      (i) =>
        i.offerId === SHORTCUT_BONUS_ID ||
        i.id === SHORTCUT_BONUS_ID ||
        i.type === "shortcut_bonus"
    );
    if (hasBonus) return items;

    const createdAt = profile?.shortcutBonusAt ?? null;

    const bonusHistory: OfferHistoryItem = {
      id: `${SHORTCUT_BONUS_ID}-history`,
      offerId: SHORTCUT_BONUS_ID,
      type: "bonus",
      amount: SHORTCUT_BONUS_AMOUNT,
      source: "pwa_shortcut",
      createdAt,
    };

    return [bonusHistory, ...items];
  };

  // ----------------------------------------------------
  // LOAD OFFERS
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

      const withShortcut = appendShortcutBonusToStartedOffers(items);

      setAllOffers(withShortcut);
      setActiveOffers(withShortcut.filter((o) => o.status !== "completed"));
      setCompletedOffers(withShortcut.filter((o) => o.status === "completed"));
      setProgressOffers(
        withShortcut.filter(
          (o) => typeof o.totalObjectives === "number" && o.totalObjectives > 0
        )
      );
    } catch (err) {
      console.error("Error loading started offers:", err);
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

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setOfferHistory(appendShortcutBonusHistory(items));
    } catch (err) {
      console.error("Error loading offer history:", err);
    } finally {
      setOfferHistoryLoading(false);
    }
  };

  // IMPORTANT CHANGE: subcollection name from "cashouts" -> "payouts"
  const loadPayoutHistory = (uid: string) => {
    setPayoutsLoading(true);

    const colRef = collection(db, "users", uid, "payouts");
    const q = query(colRef, orderBy("createdAt", "desc"));

    return onSnapshot(
      q,
      (snap) => {
        setPayouts(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );
        setPayoutsLoading(false);
      },
      (err) => {
        console.error("Error loading payout history:", err);
        setPayoutsLoading(false);
      }
    );
  };

  // ----------------------------------------------------
  // MODAL + HELPERS + UI
  // ----------------------------------------------------
  const getTimestampMs = (ts: any): number | null => {
    if (!ts) return null;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "number") return ts;
    return null;
  };

  const lastUsernameChangeMs = useMemo(
    () => getTimestampMs(profile?.usernameChangedAt),
    [profile?.usernameChangedAt]
  );

  const nextUsernameChangeMs = useMemo(() => {
    if (!lastUsernameChangeMs) return null;
    return lastUsernameChangeMs + USERNAME_COOLDOWN_MS;
  }, [lastUsernameChangeMs]);

  const canChangeUsername =
    !nextUsernameChangeMs || Date.now() >= nextUsernameChangeMs;

  const nextUsernameChangeLabel = useMemo(() => {
    if (!nextUsernameChangeMs) return null;
    return new Date(nextUsernameChangeMs).toLocaleDateString();
  }, [nextUsernameChangeMs]);

  const usernameButtonDisabled =
    !desiredUsername.trim() ||
    desiredUsername.trim() === (profile?.username ?? "") ||
    isUpdatingUsername ||
    !canChangeUsername;

  const formatTimestamp = (ts: any) => {
    if (!ts) return "--";
    if (typeof ts.toDate === "function") {
      return ts.toDate().toLocaleDateString();
    }
    if (ts instanceof Date) return ts.toLocaleDateString();
    if (typeof ts === "number") return new Date(ts).toLocaleDateString();
    return "--";
  };

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

  const handleUsernameUpdate = async () => {
    if (!user || !profile) return;

    const trimmed = desiredUsername.trim();
    setUsernameMessage(null);

    if (!trimmed) {
      setUsernameMessage("Enter a username to continue.");
      return;
    }

    if (trimmed === profile.username) {
      setUsernameMessage("That's already your username.");
      return;
    }

    if (!canChangeUsername) {
      setUsernameMessage(
        nextUsernameChangeLabel
          ? `You can change your username again on ${nextUsernameChangeLabel}.`
          : "Username changes are limited to once every 30 days."
      );
      return;
    }

    const pattern = /^[a-zA-Z0-9._-]{3,20}$/;
    if (!pattern.test(trimmed)) {
      setUsernameMessage(
        "Use 3-20 letters, numbers, dots, underscores, or hyphens."
      );
      return;
    }

    setIsUpdatingUsername(true);

    try {
      const lower = trimmed.toLowerCase();
      const dupeSnap = await getDocs(
        query(
          collection(db, "users"),
          where("usernameLower", "==", lower),
          limit(1)
        )
      );

      if (!dupeSnap.empty && dupeSnap.docs[0].id !== user.uid) {
        setUsernameMessage("That username is already taken.");
        return;
      }

      // Fallback check for older docs without usernameLower
      if (dupeSnap.empty) {
        const legacySnap = await getDocs(
          query(
            collection(db, "users"),
            where("username", "==", trimmed),
            limit(1)
          )
        );
        if (!legacySnap.empty && legacySnap.docs[0].id !== user.uid) {
          setUsernameMessage("That username is already taken.");
          return;
        }
      }

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        username: trimmed,
        usernameLower: lower,
        usernameChangedAt: serverTimestamp(),
      });

      try {
        await setDoc(
          doc(db, "publicProfiles", user.uid),
          {
            username: trimmed,
            usernameLower: lower,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (pubErr) {
        console.warn("Failed to sync public profile username", pubErr);
      }

      setUsernameMessage("Username updated. It may take a moment to refresh.");
    } catch (err) {
      console.error("Error updating username:", err);
      setUsernameMessage("Failed to update username. Try again in a bit.");
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const questStats: QuestStats = useMemo(
    () => computeQuestStats(offerHistory, referrals, questWindows),
    [offerHistory, referrals, questWindows]
  );

  const questXp = useMemo(() => {
    const segments = [
      { progress: questStats.surveysToday, target: 1, xp: 1 },
      { progress: questStats.gamesToday, target: 1, xp: 2 },
      { progress: questStats.surveysWeek, target: 10, xp: 5 },
      { progress: questStats.gamesWeek, target: 3, xp: 10 },
      { progress: questStats.referralsThisWeek, target: 1, xp: 5 },
      { progress: profile?.shortcutBonusClaimed ? 1 : 0, target: 1, xp: 5 },
      { progress: user?.emailVerified ? 1 : 0, target: 1, xp: 2 },
      { progress: Math.max(0, profile?.balance ?? 0), target: 5, xp: 8 },
      { progress: offerHistory.length > 0 ? 1 : 0, target: 1, xp: 4 },
    ];

    return segments.reduce((sum, seg) => {
      if (!seg.target) return sum;
      const completion = Math.min(1, seg.progress / seg.target);
      return sum + seg.xp * completion;
    }, 0);
  }, [
    offerHistory.length,
    profile?.balance,
    profile?.shortcutBonusClaimed,
    questStats.gamesToday,
    questStats.gamesWeek,
    questStats.referralsThisWeek,
    questStats.surveysToday,
    questStats.surveysWeek,
    user?.emailVerified,
  ]);

  const baseXp = useMemo(
    () =>
      estimateBaseXp({
        balance: profile?.balance,
        dailyStreak: profile?.dailyStreak,
        totalReferrals: questStats.totalReferrals,
        totalOfferEvents: questStats.totalOfferEvents,
      }),
    [
      profile?.balance,
      profile?.dailyStreak,
      questStats.totalOfferEvents,
      questStats.totalReferrals,
    ]
  );

  const totalXp = useMemo(() => baseXp + questXp, [baseXp, questXp]);
  const levelState = useMemo(() => computeLevelProgress(totalXp), [totalXp]);

  const questCashTotal = useMemo(() => {
    return offerHistory.reduce((sum, item) => {
      const amt = typeof item.amount === "number" ? item.amount : 0;
      const type = (item.type || "").toString().toLowerCase();
      const source = (item.source || "").toString().toLowerCase();
      if (type === "quest" || source.includes("readybread quests")) {
        return sum + amt;
      }
      return sum;
    }, 0);
  }, [offerHistory]);

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
  // FULL DASHBOARD UI
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

              <div className="dash-line" style={{ marginBottom: 6 }}>
                <span className="dash-label">Username:</span>
                <span>{profile?.username}</span>
              </div>

              <div style={{ margin: "8px 0 12px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={desiredUsername}
                    maxLength={20}
                    onChange={(e) => {
                      setDesiredUsername(e.target.value);
                      setUsernameMessage(null);
                    }}
                    placeholder="New username"
                    style={{ flex: 1 }}
                    disabled={isUpdatingUsername}
                  />
                  <button
                    className="dash-offer-btn"
                    onClick={handleUsernameUpdate}
                    disabled={usernameButtonDisabled}
                    style={
                      usernameButtonDisabled
                        ? { opacity: 0.65, cursor: "not-allowed" }
                        : undefined
                    }
                  >
                    {isUpdatingUsername ? "Saving..." : "Update"}
                  </button>
                </div>
                <p className="dash-muted dash-footnote" style={{ marginTop: 6 }}>
                  {canChangeUsername
                    ? "You can change your username once every 30 days."
                    : nextUsernameChangeLabel
                    ? `Next change available on ${nextUsernameChangeLabel}.`
                    : "Username changes are limited to once every 30 days."}
                </p>
                {usernameMessage && (
                  <p
                    className="dash-muted"
                    style={{ marginTop: 4, color: "var(--golden-toast)" }}
                  >
                    {usernameMessage}
                  </p>
                )}
              </div>

              <p className="dash-line">
                <span className="dash-label">UID:</span>
                <span style={{ fontFamily: "monospace" }}>{user?.uid}</span>
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

            <div className="dash-card modern-card glass-card">
              <h3 className="dash-card-title">Home start preference</h3>
              <p className="dash-line">
                <span className="dash-label">Status:</span>{" "}
                <span>
                  {homeOffersEnabled
                    ? "Enabled (opens Earn first)"
                    : "Disabled (opens Home first)"}
                </span>
              </p>
              <p className="dash-muted dash-footnote" style={{ marginTop: 6 }}>
                Toggle to auto-open the Earn hub when launching ReadyBread. You can still visit the Home page anytime.
              </p>
              <button
                className="dash-offer-btn"
                onClick={handleHomeOffersToggle}
                disabled={homeOffersSaving}
                style={
                  homeOffersSaving
                    ? { opacity: 0.65, cursor: "not-allowed" }
                    : undefined
                }
              >
                {homeOffersSaving
                  ? "Saving..."
                  : homeOffersEnabled
                  ? "Disable home offers"
                  : "Enable home offers?"}
              </button>
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
                      <span className="dash-label">
                        Earned From Referrals:
                      </span>{" "}
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

            {/* DANGER ZONE (overview only) */}
            <section className="dash-card modern-card glass-card danger-zone">
              <h3 className="dash-card-title" style={{ color: "var(--golden-toast)" }}>
                Danger Zone
              </h3>
              <p className="dash-muted">These actions are permanent or sensitive.</p>
              <button className="rb-btn rb-btn-danger" onClick={handleLogout}>
                Log Out
              </button>
              <br />
              <button className="rb-btn rb-btn-danger" onClick={handleDeleteAccount}>
                Delete Account
              </button>
            </section>

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
                <span className="dash-label">Quest cash (Readybread Quests):</span>{" "}
                <span>${questCashTotal.toFixed(2)}</span>
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
                      {p.notes && (
                        <p className="dash-line">
                          <span className="dash-label">Notes:</span> {p.notes}
                        </p>
                      )}
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
              <div className="dash-level-header">
                <div>
                  <h3 className="dash-card-title">Quests &amp; Level</h3>
                  <p className="dash-muted">
                    XP scales exponentially. Daily and weekly quests nudge the meter upward.
                  </p>
                </div>
                <span className="level-chip">Lv. {levelState.level}</span>
              </div>

              <div className="level-progress-bar dash-level-bar">
                <span style={{ width: `${levelState.progressPct}%` }} />
              </div>
              <div className="dash-level-meta">
                <span>
                  {levelState.currentXp} / {levelState.nextLevelXp} XP to next
                </span>
                <span>{Math.round(totalXp)} XP total</span>
              </div>

              <div className="dash-level-grid">
                <div className="dash-level-chip">
                  Today: {questStats.surveysToday}/1 surveys | {questStats.gamesToday}/1 games
                </div>
                <div className="dash-level-chip">
                  This week: {questStats.surveysWeek}/10 surveys | {questStats.gamesWeek}/3 games
                </div>
                <div className="dash-level-chip">
                  Referrals: {questStats.totalReferrals} total ({questStats.referralsThisWeek} this week)
                </div>
                <div className="dash-level-chip">
                  Shortcut bonus: {profile?.shortcutBonusClaimed ? "Claimed" : "Not yet claimed"}
                </div>
              </div>

              <Link className="rb-link" to="/quests">
                Open the Quests page
              </Link>
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

                  <div className="dash-offer-modal-body">
                    {selectedOffer.goals && selectedOffer.goals.length > 0 && (
                      <div className="dash-offer-progress-summary">
                        {(() => {
                          const total = selectedOffer.goals?.length || 0;
                          const done =
                            selectedOffer.goals?.filter((g) => g.isCompleted)
                              .length || 0;
                          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                          return (
                            <>
                              <div className="dash-progress-text">
                                <span>Goals</span>
                                <strong>
                                  {done}/{total} completed
                                </strong>
                              </div>
                              <div className="dash-progress-bar-wrap">
                                <div
                                  className="dash-progress-bar-fill"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    <div className="dash-offer-modal-summary">
                      <p className="dash-line">
                        <span className="dash-label">Payout:</span>
                        <span>
                          $
                          {selectedOffer.totalPayout?.toFixed(2) ?? "0.00"}
                        </span>
                      </p>
                      <p className="dash-line">
                        <span className="dash-label">Status:</span>
                        <span>{selectedOffer.status ?? "started"}</span>
                      </p>
                      <p className="dash-line">
                        <span className="dash-label">Started:</span>
                        <span>
                          {formatTimestamp(selectedOffer.startedAt)}
                        </span>
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
                          <p className="dash-muted">
                            Nothing completed yet.
                          </p>
                        )}
                      </div>

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
              )}
            </div>
          </div>
        )}
      </section>
    </main>
    
  );
};
