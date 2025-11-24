// src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../home.css";
import TiltCard from "../components/TiltCard";
import { useUser } from "../contexts/UserContext";
import { ChangelogCard } from "../components/ChangelogCard";
import { DailyCheckInModal } from "../components/DailyCheckInModal";
import { useDailyCheckIn } from "../hooks/useDailyCheckIn";

interface FeaturedOffer {
  id: string;
  title: string;
  payout: number;
  estMinutes?: number | null;
  source: string;
}

const BITLABS_KEY = "250f0833-3a86-4232-ae29-9b30026d1820";

export const Home: React.FC = () => {
  const { user, profile } = useUser();
  const navigate = useNavigate();

  // CLOUD-BASED streak logic (from callable function)
  const { show, loading, data, runCheckIn, hidePopup } = useDailyCheckIn();

  // Additional client-side gate: "show at most once per day per user"
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  const username =
    profile?.username || user?.email?.split("@")[0] || "Breadwinner";

  // -----------------------------
  // DAILY CHECK-IN GATE (LOCAL)
  // -----------------------------
  useEffect(() => {
    if (!user) return;

    try {
      const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const storageKey = `rb_checkin_seen_${user.uid}`;
      const lastSeen = localStorage.getItem(storageKey);

      if (lastSeen === todayKey) {
        // Already showed the modal for this user today
        return;
      }

      // Let the modal be eligible to show today
      setShowCheckInModal(true);
    } catch {
      // If anything fails (private mode, etc), we just don't block UI
    }
  }, [user]);

  const markCheckInSeenToday = () => {
    if (!user) return;
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      const storageKey = `rb_checkin_seen_${user.uid}`;
      localStorage.setItem(storageKey, todayKey);
    } catch {
      // ignore
    }
  };

  const handleCloseCheckIn = () => {
    setShowCheckInModal(false);
    markCheckInSeenToday();
    hidePopup(); // also tell the hook to stop showing
  };

  const handleRunCheckIn = async () => {
    await runCheckIn(); // calls the callable function, updates Firestore
    markCheckInSeenToday();
    setShowCheckInModal(false);
    hidePopup();
  };

  // -----------------------------
  // CURRENT STREAK / BONUS DISPLAY
  // -----------------------------
  const streakFromProfile =
    typeof profile?.dailyStreak === "number" ? profile.dailyStreak : undefined;
  const bonusFromProfile =
    typeof profile?.bonusPercent === "number"
      ? profile.bonusPercent
      : undefined;

  const currentStreak =
    typeof data?.dailyStreak === "number"
      ? data.dailyStreak
      : streakFromProfile;

  const currentBonus =
    typeof data?.bonusPercent === "number"
      ? data.bonusPercent
      : bonusFromProfile;

  // -----------------------------
  // FEATURED OFFERS (BitLabs)
  // -----------------------------
  const [featuredGame, setFeaturedGame] = useState<FeaturedOffer | null>(null);
  const [featuredSurvey, setFeaturedSurvey] = useState<FeaturedOffer | null>(
    null
  );

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

          const typeStr = (o.type || o.category || "")
            .toString()
            .toLowerCase();
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

        const games = mapped.filter((m) => m.source === "game");
        const surveys = mapped.filter((m) => m.source === "survey");

        const bestGame =
          games.sort((a, b) => b.payout - a.payout)[0] || null;
        const bestSurvey =
          surveys.sort((a, b) => b.payout - a.payout)[0] || null;

        setFeaturedGame(bestGame);
        setFeaturedSurvey(bestSurvey);
      } catch (err) {
        console.error("Error loading featured offers:", err);
      }
    };

    loadFeaturedOffers();
  }, [user]);

  return (
    <>
      {/* DAILY CHECK-IN POPUP (alert-style, blurred background) */}
      <DailyCheckInModal
        open={show && showCheckInModal}
        loading={loading}
        dailyStreak={currentStreak}
        bonusPercent={currentBonus}
        onCheckIn={handleRunCheckIn}
        onClose={handleCloseCheckIn}
      />

      <div className="landing-container">
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
              your ReadyBread account. Pick something below and keep the dough
              rolling in.
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
                View all earning options
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
                <span className="stat-value">Up to $1.00</span>
              </div>
              {currentStreak != null && currentBonus != null && (
                <div className="stat-chip">
                  <span className="stat-label">Daily streak -&gt;</span>
                  <span className="stat-value">
                    {currentStreak}d • +{currentBonus.toFixed(1)}%
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
              Install and play games from trusted partners. Hit in-game goals
              and get <span className="bread-word">paid</span>. Everything
              tracks into your ReadyBread balance.
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
              Turn your grocery runs into even more earnings. Snap a picture,
              upload, and if it matches an active offer — that&apos;s extra{" "}
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

          <TiltCard className="rw-card glass-card cashouts-card earn-card">
            <h2>💸 Satisfying Cashouts</h2>
            <p>
              Once you&apos;re happy with your stack, cash out. PayPal, Cash
              App, or donations to vetted charities, all with zero fees.
            </p>
            <br />
            <Link to="/tutorials" className="earn-cta">
              Tap to learn more
            </Link>
            <Link to="/rewards" className="earn-cta">
              View rewards &amp; cashouts
            </Link>
          </TiltCard>
        </section>

        {/* FEATURED OFFER 🔥 */}
        <section className="featured-offer-section">
          <h3 className="section-heading">FEATURED OFFER 🔥</h3>
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

        {/* STRIP */}
        <section className="landing-strip">
          <h2>
            Logged in, chillin&apos;, and ready to{" "}
            <span className="bread-word">earn</span>.
          </h2>
          <p>
            ReadyBread is built to feel more like a game than a chore. Pick your
            vibe — games, surveys, receipts, or referrals — and keep stacking
            your bread at your own pace.
          </p>
        </section>

        {/* NEWS / UPDATES (CHANGELOG) */}
        <section className="home-updates">
          <h3 className="section-heading">Latest updates &amp; changes</h3>
          <div className="home-updates-inner glass-card">
            <ChangelogCard />
          </div>
        </section>

        {/* FOOTER */}
        <footer className="landing-footer">
          © {new Date().getFullYear()} ReadyBread — thanks for being part of the
          bakery!
        </footer>
      </div>
    </>
  );
};

export default Home;
