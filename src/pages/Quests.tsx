import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../quests.css";
import { useUser } from "../contexts/UserContext";
import { db } from "../config/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { isIos, isMobileDevice, isStandaloneMode } from "../utils/pwa";
import { computeLevelProgress, estimateBaseXp } from "../utils/level";
import { computeQuestStats, getQuestWindows } from "../utils/questsMath";
import type {
  QuestHistoryItem,
  QuestReferralDoc,
  QuestStats,
  QuestWindows,
} from "../utils/questsMath";

type QuestDefinition = {
  id: string;
  title: string;
  rewardCash: number;
  rewardXp: number;
  target: number;
  progress: number;
  description?: string;
  link?: string;
  actionLabel?: string;
  progressLabel?: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const REFERRAL_CAP = 10;

const formatCountdown = (targetMs: number): string => {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "resetting now";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const formatResetLabel = (targetMs: number): string => {
  return new Date(targetMs).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const Quests: React.FC = () => {
  const { user, profile } = useUser();
  const navigate = useNavigate();

  const [offerHistory, setOfferHistory] = useState<QuestHistoryItem[]>([]);
  const [referralDocs, setReferralDocs] = useState<QuestReferralDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [questWindows, setQuestWindows] = useState<QuestWindows>(getQuestWindows());

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installingPwa, setInstallingPwa] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [hidePwaCard, setHidePwaCard] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  useEffect(() => {
    setHidePwaCard(false);
    setInstallError(null);
  }, [user?.uid]);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      if (!isIos()) {
        setInstallError('Use your browser menu and pick "Add to home screen" to install.');
      }
      return;
    }

    try {
      setInstallError(null);
      setInstallingPwa(true);
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice?.outcome === "dismissed") {
        setInstallError("Install dismissed. You can try again anytime.");
      }

      setInstallPrompt(null);
    } catch (err: any) {
      setInstallError(err?.message || "Install prompt was blocked. Try your browser menu.");
    } finally {
      setInstallingPwa(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setOfferHistory([]);
      setReferralDocs([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const offersRef = collection(db, "users", user.uid, "offers");
        const offersSnap = await getDocs(query(offersRef, orderBy("createdAt", "desc")));
        setOfferHistory(
          offersSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );

        const refSnap = await getDocs(collection(db, "users", user.uid, "referrals"));
        setReferralDocs(refSnap.docs.map((d) => d.data() as QuestReferralDoc));
      } catch (err) {
        console.error("Error loading quest data:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuestWindows(getQuestWindows());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const questStats: QuestStats = useMemo(
    () => computeQuestStats(offerHistory, referralDocs, questWindows),
    [offerHistory, referralDocs, questWindows]
  );

  const dailyQuests: QuestDefinition[] = useMemo(
    () => [
      {
        id: "daily-survey",
        title: "Complete a survey!",
        rewardCash: 0.01,
        rewardXp: 1,
        target: 1,
        progress: questStats.surveysToday,
        description: "Any survey completion today counts toward this goal.",
        link: "/surveys",
        actionLabel: "Open surveys",
      },
      {
        id: "daily-game",
        title: "Make progress on a game offer!",
        rewardCash: 0.01,
        rewardXp: 2,
        target: 1,
        progress: questStats.gamesToday,
        description: "Hit an in-game milestone or objective today.",
        link: "/games",
        actionLabel: "View games",
      },
    ],
    [questStats.gamesToday, questStats.surveysToday]
  );

  const weeklyQuests: QuestDefinition[] = useMemo(
    () => [
      {
        id: "week-surveys",
        title: "Complete 10 surveys this week!",
        rewardCash: 0.05,
        rewardXp: 5,
        target: 10,
        progress: questStats.surveysWeek,
        description: "Keep your survey streak alive through the week.",
        link: "/surveys",
        actionLabel: "Keep answering",
      },
      {
        id: "week-games",
        title: "Make progress 3 times on a game offer!",
        rewardCash: 0.05,
        rewardXp: 10,
        target: 3,
        progress: questStats.gamesWeek,
        description: "Stack milestones across any game offers this week.",
        link: "/games",
        actionLabel: "Continue games",
      },
      {
        id: "week-referral",
        title: "Refer a friend!",
        rewardCash: 0.05,
        rewardXp: 5,
        target: 1,
        progress: questStats.referralsThisWeek,
        description: "Share your code and bring someone new to ReadyBread.",
        link: "/dashboard",
        actionLabel: "Share code",
      },
    ],
    [questStats.gamesWeek, questStats.referralsThisWeek, questStats.surveysWeek]
  );

  const generalQuests: QuestDefinition[] = useMemo(() => {
    const balance = Math.max(0, profile?.balance ?? 0);
    const shortcutClaimed = profile?.shortcutBonusClaimed === true;
    const emailVerified = user?.emailVerified === true;

    return [
      {
        id: "home-screen",
        title: "Add ReadyBread to your home screen",
        rewardCash: 0.05,
        rewardXp: 5,
        target: 1,
        progress: shortcutClaimed ? 1 : 0,
        progressLabel: shortcutClaimed ? "Installed" : "Not installed",
        description: "Install the app-like shortcut and pick up the bonus.",
        link: "#pwa-card",
        actionLabel: shortcutClaimed ? "Installed" : "Install now",
      },
      {
        id: "email-verified",
        title: "Verify your email",
        rewardCash: 0.01,
        rewardXp: 2,
        target: 1,
        progress: emailVerified ? 1 : 0,
        progressLabel: emailVerified ? "Verified" : "Pending",
        description: "Keep your earnings secure and notifications flowing.",
        link: "/security",
        actionLabel: emailVerified ? "All set" : "Verify",
      },
      {
        id: "balance-five",
        title: "Reach $5 in your balance",
        rewardCash: 0,
        rewardXp: 8,
        target: 5,
        progress: balance,
        progressLabel: `$${balance.toFixed(2)} / $5.00`,
        description: "Chip away with surveys, games, and referrals.",
        link: "/dashboard",
        actionLabel: "View balance",
      },
      {
        id: "first-offer",
        title: "Complete your first offer",
        rewardCash: 0.02,
        rewardXp: 4,
        target: 1,
        progress: questStats.totalOfferEvents > 0 ? 1 : 0,
        description: "Any game, survey, or receipt completion counts.",
        link: "/earn",
        actionLabel: "Find an offer",
      },
    ];
  }, [profile, questStats.totalOfferEvents, user?.emailVerified]);

  const questXp = useMemo(() => {
    const all = [...dailyQuests, ...weeklyQuests, ...generalQuests];
    return all.reduce((sum, quest) => {
      if (quest.target <= 0) return sum;
      const completion = Math.min(1, quest.progress / quest.target);
      return sum + quest.rewardXp * completion;
    }, 0);
  }, [dailyQuests, weeklyQuests, generalQuests]);

  const baseXp = useMemo(
    () =>
      estimateBaseXp({
        balance: profile?.balance,
        dailyStreak: profile?.dailyStreak,
        totalReferrals: questStats.totalReferrals,
        totalOfferEvents: questStats.totalOfferEvents,
      }),
    [profile, questStats.totalOfferEvents, questStats.totalReferrals]
  );

  const levelState = useMemo(
    () => computeLevelProgress(baseXp + questXp),
    [baseXp, questXp]
  );

  const pwaComplete = profile?.shortcutBonusClaimed === true;

  const shouldShowPwaCard =
    Boolean(
      user &&
        profile &&
        isMobileDevice() &&
        !pwaComplete &&
        !isStandaloneMode()
    ) && !hidePwaCard;

  const heroName =
    profile?.username || user?.email?.split("@")[0] || "Breadwinner";

  const handleQuestClick = (quest: QuestDefinition) => {
    if (!quest.link) return;

    if (quest.link.startsWith("http")) {
      window.open(quest.link, "_blank");
      return;
    }

    if (quest.link.startsWith("#")) {
      const el = document.querySelector(quest.link);
      if (el) el.scrollIntoView({ behavior: "smooth" });
      return;
    }

    navigate(quest.link);
  };

  const renderQuestCard = (quest: QuestDefinition) => {
    const completion = quest.target <= 0 ? 0 : Math.min(1, quest.progress / quest.target);
    const completed = completion >= 1;
    const progressLabel =
      quest.progressLabel ?? `${Math.min(quest.progress, quest.target)} / ${quest.target}`;

    return (
      <div
        key={quest.id}
        className={`quest-card ${completed ? "quest-card-complete" : ""}`}
      >
        <div className="quest-card-top">
          <div>
            <div className="quest-reward-pill">
              <span>+${quest.rewardCash.toFixed(2)}</span>
              <span>+{quest.rewardXp}xp</span>
            </div>
            <h4 className="quest-title">{quest.title}</h4>
            {quest.description && <p className="quest-desc">{quest.description}</p>}
          </div>
          {completed && <span className="quest-badge">Completed</span>}
        </div>

        <div className="quest-progress">
          <div className="quest-progress-bar">
            <span style={{ width: `${completion * 100}%` }} />
          </div>
          <div className="quest-progress-meta">
            <span>{progressLabel}</span>
            <span>{quest.rewardXp} xp</span>
          </div>
        </div>

        {quest.link && (
          <button
            className="quest-cta-btn"
            type="button"
            onClick={() => handleQuestClick(quest)}
          >
            {quest.actionLabel || "Open"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="quests-page">
      <section className="quests-hero">
        <div className="quests-hero-copy">
          <div className="quests-kickers">
            <span className="quests-pill">Quests</span>
            <span className="quests-pill subtle">
              Daily resets 12am ET - Weekly resets Monday
            </span>
          </div>
          <h1 className="quests-title">
            Keep the streak alive, <span className="bread-word">{heroName}</span>
          </h1>
          <p className="quests-subtitle">
            Daily and weekly achievements track automatically. XP fuels your
            ReadyBread level (no perks yet, just bragging rights).
          </p>
          <div className="quests-reset-row">
            <div className="reset-chip">
              <span>Daily resets</span>
              <strong>{formatCountdown(questWindows.nextDailyReset)}</strong>
              <small>{formatResetLabel(questWindows.nextDailyReset)} ET</small>
            </div>
            <div className="reset-chip">
              <span>Weekly resets</span>
              <strong>{formatCountdown(questWindows.nextWeeklyReset)}</strong>
              <small>{formatResetLabel(questWindows.nextWeeklyReset)} ET</small>
            </div>
            <div className="reset-chip faint">
              <span>Data</span>
              <strong>{loading ? "Updating..." : "Live"}</strong>
              <small>Surveys, games, referrals</small>
            </div>
          </div>
        </div>

        <div className="level-card">
          <div className="level-card-head">
            <p className="quests-pill">Level</p>
            <span className="level-chip">Lv. {levelState.level}</span>
          </div>
          <h3 className="level-number">{levelState.level}</h3>
          <div className="level-progress-bar">
            <span style={{ width: `${levelState.progressPct}%` }} />
          </div>
          <div className="level-meta">
            <span>
              {levelState.currentXp} / {levelState.nextLevelXp} XP
            </span>
            <span>{levelState.totalXp} XP total</span>
          </div>
          <p className="level-footnote">
            XP grows exponentially each level. Keep stacking daily and weekly goals.
          </p>
          <Link to="/dashboard" className="level-link">
            View level on dashboard
          </Link>
        </div>
      </section>

      <section className="quests-grid">
        <div className="quest-section">
          <div className="quest-section-head">
            <div>
              <p className="quests-pill subtle">Today</p>
              <h3>Daily achievements</h3>
              <p className="section-sub">Resets at midnight Eastern.</p>
            </div>
            <span className="section-reset">
              Next: {formatCountdown(questWindows.nextDailyReset)}
            </span>
          </div>
          <div className="quest-card-grid">
            {dailyQuests.map(renderQuestCard)}
          </div>
        </div>

        <div className="quest-section">
          <div className="quest-section-head">
            <div>
              <p className="quests-pill subtle">This week</p>
              <h3>Weekly achievements</h3>
              <p className="section-sub">Resets Monday at 12:00am ET.</p>
            </div>
            <span className="section-reset">
              Next: {formatCountdown(questWindows.nextWeeklyReset)}
            </span>
          </div>
          <div className="quest-card-grid">
            {weeklyQuests.map(renderQuestCard)}
          </div>
        </div>

        <div className="quest-section">
          <div className="quest-section-head">
            <div>
              <p className="quests-pill subtle">Always-on</p>
              <h3>General tasks</h3>
              <p className="section-sub">
                Evergreen goals you can complete anytime. Easy to add more later.
              </p>
            </div>
          </div>
          <div className="quest-card-grid">
            {generalQuests.map(renderQuestCard)}
          </div>
        </div>
      </section>

      <section className="quests-bottom-grid">
        <div className="referral-card">
          <div className="referral-head">
            <div>
              <p className="quests-pill subtle">Referrals</p>
              <h3>Bring friends, climb faster</h3>
              <p className="section-sub">
                Every friend moves the bar. Hit the cap to max this track.
              </p>
            </div>
            <span className="level-chip faint">
              {questStats.totalReferrals} / {REFERRAL_CAP}
            </span>
          </div>
          <div className="referral-bar">
            <span
              style={{
                width: `${Math.min(100, (questStats.totalReferrals / REFERRAL_CAP) * 100)}%`,
              }}
            />
          </div>
          <div className="referral-meta">
            <span>
              {questStats.totalReferrals} total | {questStats.referralsThisWeek} this week
            </span>
            <button
              type="button"
              className="quest-cta-btn ghost"
              onClick={() => navigate("/dashboard")}
            >
              Open referrals
            </button>
          </div>
        </div>

        {shouldShowPwaCard ? (
          <div className="pwa-card" id="pwa-card">
            <div className="pwa-card-copy">
              <span className="quests-pill">Home screen bonus</span>
              <h3>Add ReadyBread to your home screen</h3>
              <p>
                Install the shortcut, launch from your home screen, and we will
                drop <span className="bread-word">$0.05</span> into your balance
                (once per account).
              </p>
              <div className="pwa-steps">
                <div className="step-pill">
                  {isIos()
                    ? "Tap Share > Add to Home Screen"
                    : "Tap Install from your browser menu"}
                </div>
                <div className="step-pill">Launch ReadyBread shortcut</div>
                <div className="step-pill">Bonus auto-claims</div>
              </div>
              {installError && <p className="pwa-error">{installError}</p>}
            </div>
            <div className="pwa-actions">
              <button
                className="quest-cta-btn"
                type="button"
                onClick={handleInstallClick}
                disabled={installingPwa}
              >
                {installingPwa ? "Waiting for install..." : "Install & claim $0.05"}
              </button>
              <button
                className="quest-cta-btn ghost"
                type="button"
                onClick={() => setHidePwaCard(true)}
              >
                Maybe later
              </button>
            </div>
          </div>
        ) : (
          <div className={`pwa-card ${pwaComplete ? "complete" : ""}`} id="pwa-card">
            <div>
              <span className="quests-pill">Home screen bonus</span>
              <h3>{pwaComplete ? "Installed" : "Grab this on mobile"}</h3>
              <p className="section-sub">
                {pwaComplete
                  ? "You have already claimed this quest. Launch from your home screen anytime for the fastest path into ReadyBread."
                  : "Install ReadyBread from your mobile browser to claim this bonus."}
              </p>
            </div>
            <div className="pwa-actions">
              <button
                className="quest-cta-btn ghost"
                type="button"
                onClick={() => navigate("/dashboard")}
              >
                Go to dashboard
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};


