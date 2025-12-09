// src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../home.css";
import TiltCard from "../components/TiltCard";
import { useUser } from "../contexts/UserContext";
import { db } from "../config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ChangelogCard } from "../components/ChangelogCard";

interface FeaturedOffer {
  id: string;
  title: string;
  payout: number;
  estMinutes?: number | null;
  source: string;
}

import { getClientIp } from "../utils/ip";

const BITLABS_KEY = "250f0833-3a86-4232-ae29-9b30026d1820";
const CPX_APP_ID = "30102";
const CPX_HASH = "yvxLR6x1Jc1CptNFfmrhzYlAu1XqVfsj";

type MergedSurvey = {
  id: string;
  title: string;
  payout: number;
  minutes: number | null;
  source: "bitlabs" | "cpx";
};

export const Home: React.FC = () => {
  <p><br></br></p>
  const { user, profile } = useUser();
  const navigate = useNavigate();

  const username =
    profile?.username ||
    user?.email?.split("@")[0] ||
    "Breadwinner";
  const homeOffersEnabled = profile?.homeOffersEnabled === true;
  const [homeOffersSaving, setHomeOffersSaving] = useState(false);

  // ---------- DAILY CHECK-IN ----------
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [pendingStreak, setPendingStreak] = useState<number | null>(null);
  const [pendingBonus, setPendingBonus] = useState<number | null>(null); // percent, e.g. 3.5
  const [currentStreak, setCurrentStreak] = useState<number | null>(null);
  const [currentBonus, setCurrentBonus] = useState<number | null>(null);
  const [checkInSaving, setCheckInSaving] = useState(false);

  // ---------- FEATURED OFFERS ----------
  const [featuredGame, setFeaturedGame] = useState<FeaturedOffer | null>(null);
  const [featuredSurvey, setFeaturedSurvey] = useState<FeaturedOffer | null>(
    null
  );

  // Load / compute daily check-in once user is known
  useEffect(() => {
    const loadCheckIn = async () => {
      if (!user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};

        const existingStreak = (data.dailyStreak as number | undefined) ?? 0;
        const existingBonus = (data.bonusPercent as number | undefined) ?? 0;

        // Handle lastCheckIn as Firestore Timestamp or Date/string fallback
        let lastCheckInDate: Date | null = null;
        const rawLast = (data.lastCheckIn as any) ?? null;
        if (rawLast?.toDate) {
          lastCheckInDate = rawLast.toDate();
        } else if (typeof rawLast === "string" || rawLast instanceof Date) {
          lastCheckInDate = new Date(rawLast);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let needsCheckIn = false;
        let newStreak = 1;

        if (!lastCheckInDate) {
          // First time check-in
          needsCheckIn = true;
          newStreak = 1;
        } else {
          const last = new Date(lastCheckInDate);
          last.setHours(0, 0, 0, 0);
          const diffDays = Math.floor(
            (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diffDays === 0) {
            // Already checked in today
            needsCheckIn = false;
            newStreak = existingStreak || 1;
          } else if (diffDays === 1) {
            // Continue streak
            needsCheckIn = true;
            newStreak = (existingStreak || 0) + 1;
          } else if (diffDays > 1) {
            // Streak reset
            needsCheckIn = true;
            newStreak = 1;
          } else {
            // Future/timezone weirdness, just keep current
            needsCheckIn = false;
            newStreak = existingStreak || 1;
          }
        }

        // Bonus: +0.5% per day after day 1, capped at 10% (reach 10% on day 21)
        const calculatedBonus = Math.min(Math.max(newStreak - 1, 0) * 0.5, 10); // percent

        if (needsCheckIn) {
          setPendingStreak(newStreak);
          setPendingBonus(calculatedBonus);
          setShowCheckInModal(true);
        } else {
          setCurrentStreak(existingStreak || newStreak);
          setCurrentBonus(existingBonus || calculatedBonus);
        }
      } catch (err) {
        console.error("Error loading daily check-in:", err);
      }
    };

    loadCheckIn();
  }, [user]);

  const handleConfirmCheckIn = async () => {
    if (!user || pendingStreak == null || pendingBonus == null) {
      setShowCheckInModal(false);
      return;
    }

    const roundedBonus = Math.round(pendingBonus * 100) / 100;

    try {
      setCheckInSaving(true);
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          dailyStreak: pendingStreak,
          bonusPercent: roundedBonus,
          lastCheckIn: serverTimestamp(),
        },
        { merge: true }
      );

      setCurrentStreak(pendingStreak);
      setCurrentBonus(roundedBonus);
    } catch (err) {
      console.error("Error saving daily check-in:", err);
    } finally {
      setCheckInSaving(false);
      setShowCheckInModal(false);
    }
  };

  // Fetch featured offers (BitLabs) once user is known
  useEffect(() => {
    const loadFeaturedOffers = async () => {
      if (!user) return;

      try {
        const res = await fetch("https://api.bitlabs.ai/v2/client/offers", {
          headers: {
            "X-Api-Token": BITLABS_KEY,
            "X-User-Id": user.uid,
            "X-Api-Sdk": "CUSTOM",
          },
        });

        if (!res.ok) return;

        const json = await res.json();
        const rawOffers = (json?.data?.offers || []) as any[];

        if (!Array.isArray(rawOffers) || rawOffers.length === 0) return;

        // Normalize
        const mapped = rawOffers.map((o) => {
          const payout =
            typeof o.payout === "number"
              ? o.payout
              : parseFloat(o.points ?? o.reward ?? 0) / 100;

          const estMinutes =
            typeof o.est_minutes === "number"
              ? o.est_minutes
              : o.hours_left
              ? o.hours_left * 60
              : null;

          // crude type guess
          const typeStr = (o.type || o.category || "").toString().toLowerCase();
          const looksLikeGame =
            typeStr.includes("game") ||
            typeStr.includes("app") ||
            !!o.app_metadata ||
            !!o.store_app_id;

          return {
            id: String(o.id),
            title: o.title || "Offer",
            payout: isNaN(payout) ? 0 : payout,
            estMinutes,
            source: looksLikeGame ? "game" : "survey",
          } as FeaturedOffer;
        });

        const bestGame =
          mapped
            .filter((m) => m.source === "game")
            .sort((a, b) => b.payout - a.payout)[0] || null;

        setFeaturedGame(bestGame);
      } catch (err) {
        console.error("Error loading featured offers:", err);
      }
    };

    loadFeaturedOffers();
  }, [user]);

  // Load the single highest paying survey across all providers
  useEffect(() => {
    const fetchBitlabsSurveys = async (): Promise<MergedSurvey[]> => {
      try {
        const res = await fetch("https://api.bitlabs.ai/v2/client/surveys", {
          method: "GET",
          headers: {
            "X-Api-Token": BITLABS_KEY,
            "X-User-Id": user?.uid || "UNKNOWN",
            "X-Api-Sdk": "CUSTOM",
          },
        });

        if (!res.ok) return [];

        const data = await res.json();
        const surveys = (data?.data?.surveys || []) as any[];

        return surveys.map((s) => ({
          source: "bitlabs" as const,
          id: String(s.id),
          title: s.category?.name || "Survey",
          payout: Number(s.cpi || 0),
          minutes: typeof s.loi === "number" ? s.loi : null,
        }));
      } catch (err) {
        console.error("Error loading BitLabs surveys for featured:", err);
        return [];
      }
    };

    const fetchCpxSurveys = async (): Promise<MergedSurvey[]> => {
      try {
        const userIP = await getClientIp();
        const userAgent =
          typeof navigator !== "undefined" ? navigator.userAgent : "";

        const url =
          `https://live-api.cpx-research.com/api/get-surveys.php?` +
          `app_id=${CPX_APP_ID}` +
          `&ext_user_id=${encodeURIComponent(user?.uid || "")}` +
          `&output_method=api` +
          (userIP ? `&ip_user=${encodeURIComponent(userIP)}` : "") +
          `&user_agent=${encodeURIComponent(userAgent)}` +
          `&limit=50` +
          `&secure_hash=${encodeURIComponent(CPX_HASH)}`;

        const res = await fetch(url);
        const json = await res.json();

        if (!json?.surveys || !Array.isArray(json.surveys)) {
          return [];
        }

        return (json.surveys as any[]).map((s) => {
          const minutesVal = Number(s.loi ?? s.minutes);
          const payoutVal = Number(s.payout ?? s.reward_usd ?? 0);

          return {
            source: "cpx" as const,
            id: String(s.id),
            title: s.name || "Survey",
            payout: Number.isFinite(payoutVal) ? payoutVal : 0,
            minutes: Number.isFinite(minutesVal) ? minutesVal : null,
          };
        });
      } catch (err) {
        console.error("Error loading CPX surveys for featured:", err);
        return [];
      }
    };

    const loadTopSurvey = async () => {
      if (!user) return;

      const [bitlabs, cpx] = await Promise.all([
        fetchBitlabsSurveys(),
        fetchCpxSurveys(),
      ]);
      const merged = [...bitlabs, ...cpx];

      merged.sort((a, b) => b.payout - a.payout);
      const top = merged[0];

      if (top) {
        setFeaturedSurvey({
          id: top.id,
          title: top.title,
          payout: top.payout,
          estMinutes: top.minutes,
          source: "survey",
        });
      } else {
        setFeaturedSurvey(null);
      }
    };

    loadTopSurvey();
  }, [user]);

  const handleHomeOffersToggle = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

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

  return (
    <>
      {/* DAILY CHECK-IN POPUP */}
      {showCheckInModal && pendingStreak != null && pendingBonus != null && (
        <div className="checkin-overlay">
          <div className="checkin-modal">
            <h2 className="checkin-title">Welcome back, {username}!</h2>
            <p className="checkin-body">
              Thanks for checking in today. Your daily streak has been updated.
              All eligible earnings now get a{" "}
              <span className="bread-word">
                +{pendingBonus.toFixed(1)}% boost
              </span>{" "}
              (up to 10% max).
            </p>

            <div className="checkin-meta">
              <div>
                <span className="checkin-label">Current streak</span>
                <span className="checkin-value">
                  {pendingStreak} day{pendingStreak !== 1 ? "s" : ""}
                </span>
              </div>
              <div>
                <span className="checkin-label">Bonus multiplier</span>
                <span className="checkin-value">
                  +{pendingBonus.toFixed(1)}%
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary checkin-ok-btn"
              onClick={handleConfirmCheckIn}
              disabled={checkInSaving}
            >
              {checkInSaving ? "Saving..." : "OK, let's earn"}
            </button>
          </div>
        </div>
      )}

      <div className="landing-container">
        <div className="home-pref-banner">
          <div>
            <p className="pref-label">Enable home offers?</p>
            <p className="pref-sub">
              When on, opening ReadyBread jumps straight to the Earn hub. You can still open this Home page anytime.
            </p>
            <p className="pref-status">
              Status: {homeOffersEnabled ? "Enabled (starts at Earn)" : "Disabled (starts at Home)"}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary pref-btn"
            onClick={handleHomeOffersToggle}
            disabled={homeOffersSaving}
          >
            {homeOffersSaving
              ? "Saving..."
              : homeOffersEnabled
              ? "Turn off home offers"
              : "Enable home offers?"}
          </button>
        </div>

        {/* HERO */}
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <h1 className="landing-title">
              Ready to get some <span className="bread-word">Bread</span>,{" "}
              {username}?
            </h1>

            <h2 className="landing-slogan">
              Jump back into <span className="bread-word">games</span>,{" "}
              <span className="bread-word">surveys</span>, and{" "}
              <span className="bread-word">rewards</span>, all in one place.
            </h2>

            <p className="landing-subtitle">
              Your balance, offers, receipts, and withdrawals are all tracked in
              your ReadyBread account. Pick something below and keep the earning your bread.
            </p>

            <div className="hero-buttons">
              <button
                className="btn-primary"
                type="button"
                onClick={() => navigate("/dashboard")}
              >
                Open Dashboard
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => navigate("/earn")}
              >
                View All Earning Options
              </button>
            </div>

            <div className="landing-stats-row">
              <div className="stat-chip">
                <span className="stat-label">Today&apos;s focus -&gt;</span>
                <span className="stat-value">Earn with games!</span>
              </div>
              <div className="stat-chip">
                <span className="stat-label">Quick win -&gt;</span>
                <span className="stat-value">Finish a survey!</span>
              </div>
              <div className="stat-chip">
                <span className="stat-label">Referral bonus -&gt;</span>
                <span className="stat-value">Up to 10 referrals</span>
              </div>
              {currentStreak && currentBonus != null && (
                <div className="stat-chip">
                  <span className="stat-label">Daily streak -&gt;</span>
                  <span className="stat-value">
                    {currentStreak}d | +{currentBonus.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FEATURE CARDS (LOGGED-IN SHORTCUTS) */}
        <section className="feature-grid">
          <TiltCard className="rw-card glass-card games-card earn-card">
            <h2>🎮 Game &amp; App Offers</h2>
            <p>
              Install and play games from trusted partners. Hit
              in-game goals and get <span className="bread-word">paid</span>.
              Everything tracks into your ReadyBread balance.
            </p>
            <br />
            <Link to="/tutorials" className="earn-cta">
              Tap to learn more (❗)
            </Link>
            <br />
            <Link to="/games" className="earn-cta">
              Continue with games
            </Link>
          </TiltCard>

          <TiltCard className="rw-card glass-card surveys-card earn-card">
            <h2>📋 Survey Streaks</h2>
            <p>
              Fill surveys when you have a few spare minutes, on the bus, in the
              bathroom, etc. Great for stacking consistent small hits of{" "}
              <span className="bread-word">bread</span>.
            </p>
            <br />
            <Link to="/tutorials" className="earn-cta">
              Tap to learn more
            </Link>
            <br />
            <Link to="/surveys" className="earn-cta">
              Continue with surveys
            </Link>
          </TiltCard>

          <TiltCard className="rw-card glass-card receipts-card earn-card">
            <h2>🧾 Magic Receipts</h2>
            <p>
              Earn like a wizard with Magic Receipts. Snap a picture of your receipt,
              upload, and if it matches an active offer, that&apos;s extra{" "}
              <span className="bread-word">bread</span> for you.
            </p>
            <br />
            <Link to="/tutorials" className="earn-cta">
              Tap to learn more
            </Link>
            <br />
            <Link to="/receipts" className="earn-cta">
              Upload a receipt
            </Link>
          </TiltCard>
        </section>

        <section className="feature-grid">
          <TiltCard className="rw-card glass-card cashouts-card earn-card">
            <h2>Cashout via Mobile Bank</h2>
            <p>
              Once you&apos;re happy with your stack, cash out. Get a direct
              payment, with 0 fees.
            </p>
            <br />
            <Link to="/tutorials" className="earn-cta">
              Tap to learn more
            </Link>
            <br />
            <Link to="/rewards" className="earn-cta">
              View cashout options
            </Link>
          </TiltCard>

          <TiltCard className="rw-card glass-card cashouts-card earn-card">
            <h2>Cashout via Bitcoin</h2>
            <p>
              Skip the mobile banking and get your payment via bitcoin, to any bitcoin wallet
              you want.
            </p>
            <br />
            <Link to="/tutorials" className="earn-cta">
              Tap to learn more
            </Link>
            <br />
            <Link to="/rewards" className="earn-cta">
              View cashout options
            </Link>
          </TiltCard>

          <TiltCard className="rw-card glass-card cashouts-card earn-card">
            <h2>Cashout via Donations</h2>
            <p>
              Feeling generous? Donate your earnings, and we will match 5% to your 
              charity of choice.
            </p>
            <br />
            <Link to="/tutorials" className="earn-cta">
              Tap to learn more
            </Link>
            <br />
            <Link to="/rewards" className="earn-cta">
              View cashout options
            </Link>
          </TiltCard>
        </section>

        {/* 🔥FEATURED OFFER🔥 */}
        <section className="featured-offer-section">
          <h3 className="section-heading">🔥FEATURED OFFERS🔥</h3>
          <div className="featured-offer-grid">
            <div
              className="featured-card glass-card featured-game"
              onClick={() => navigate("/games")}
            >
              <h4>Top Game Offer</h4>
              {featuredGame ? (
                <>
                  <p className="featured-title">{featuredGame.title}</p>
                  <p className="featured-meta">
                    <span>${featuredGame.payout.toFixed(2)} total</span>
                    {featuredGame.estMinutes != null && (
                      <span>~{featuredGame.estMinutes} min</span>
                    )}
                  </p>
                  <p className="featured-note">
                    Tap to view more game offers inside the Games section.
                  </p>
                </>
              ) : (
                <p className="featured-placeholder">
                  We&apos;re loading your best game offer… tap to explore all.
                </p>
              )}
            </div>

            <div
              className="featured-card glass-card featured-survey"
              onClick={() => navigate("/surveys")}
            >
              <h4>Top Survey Offer</h4>
              {featuredSurvey ? (
                <>
                  <p className="featured-title">{featuredSurvey.title}</p>
                  <p className="featured-meta">
                    <span>${featuredSurvey.payout.toFixed(2)} total</span>
                    {featuredSurvey.estMinutes != null && (
                      <span>~{featuredSurvey.estMinutes} min</span>
                    )}
                  </p>
                  <p className="featured-note">
                    Tap to view more surveys and keep your streak alive.
                  </p>
                </>
              ) : (
                <p className="featured-placeholder">
                  We&apos;re finding the best survey for you… tap to browse
                  surveys.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* REFERRAL & EXTENSION STRIP (LOGGED-IN VIEW) */}
        <section className="referral-section">
          <h3 className="section-heading">Boost your bread even faster</h3>
          <div className="referral-inner glass-card">
            <div className="referral-left">
              <h3>🤝 Invite friends, stack bonuses</h3>
              <p>
                Share your referral code and earn a bonus each time a friend
                joins and starts completing offers. Perfect for Discord servers,
                group chats, and content descriptions.
              </p>
              <br />
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate("/dashboard")}
              >
                Open my referral info
              </button>
            </div>
            <div className="referral-right">
              <h4>🌎 Browser Extension</h4>
              <p>
                This feature is still <i>half-baked</i>. Please check back
                another time.
              </p>
            </div>
          </div>
        </section>

        {/* 🧪 BREADGAME BETA CARD */}
        <section className="feature-grid">
          <TiltCard className="rw-card glass-card breadgame-beta-card earn-card">
            <h2>🥖 BreadGame BETA</h2>

            <p className="beta-desc">
              Test our brand-new <span className="bread-word">BreadClicker</span>, 
              a Clicker-style mini-game where you earn crumbs, unlock upgrades, 
              turn off that brain, start clicking, and collect <b>up to $0.10/day</b> in bonus earnings.
            </p>

            <p className="beta-warning">
              ⚠️ This feature is currently <b>in beta</b>.  
              Bugs, lag, visual glitches, and resets may occur.  
              Your feedback helps us shape the final release!
            </p>

            <div className="beta-code-snippet">
              <pre>
        {`// ReadyBread: BreadGame Beta
        clickBread();
        upgradeToaster();
        earnCrumbs();
        profit();`}
              </pre>
            </div>

            <button
              className="btn-primary"
              type="button"
              onClick={() => navigate("/breadgame")}
            >
              Play BreadGame (Beta)
            </button>
          </TiltCard>
        </section>

        {/* STRIP */}
        <section className="landing-strip">
          <h2>
            Logged in, chillin', and ready to{" "}
            <span className="bread-word">earn</span>.
          </h2>
          <p>
            ReadyBread is built to feel more like a game than a chore. Pick your
            vibe, games, surveys, receipts, or referrals, and keep stacking your
            bread at your own pace.
          </p>
        </section>

        {/* NEWS / UPDATES (CHANGELOG) */}
        <section className="home-updates">
          <h3 className="section-heading">Latest updates & changes</h3>
          <div className="home-updates-inner glass-card">
            <ChangelogCard />
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;
