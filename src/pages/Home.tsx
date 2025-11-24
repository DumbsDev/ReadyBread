// import React, { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../home.css";
import TiltCard from "../components/TiltCard";
import { useUser } from "../contexts/UserContext";

export const Home: React.FC = () => {
  const { user, profile } = useUser();
  const navigate = useNavigate();

  const username =
    profile?.username ||
    user?.email?.split("@")[0] ||
    "Breadwinner";

  return (
    <div className="landing-container">
      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <h1 className="landing-title">
            Ready to get some <span className="bread-word">Bread</span>, {username}?
          </h1>

          <h2 className="landing-slogan">
            Jump back into <span className="bread-word">games</span>,{" "}
            <span className="bread-word">surveys</span>, and{" "}
            <span className="bread-word">rewards</span>, all in one place.
          </h2>

          <p className="landing-subtitle">
            Your balance, offers, receipts, and withdrawals are all tracked in your
            ReadyBread account. Pick something below and keep the dough rolling in.
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
          </div>
        </div>
      </section>

      {/* FEATURE CARDS (LOGGED-IN SHORTCUTS) */}
      <section className="feature-grid">
        <TiltCard className="rw-card glass-card games-card earn-card">
          <h2>🎮 Game &amp; App Offers</h2>
          <p>
            Install and play games from partners like BitLabs and AdGem. Hit
            in-game goals and get <span className="bread-word">paid</span>.
            Everything tracks into your ReadyBread balance.
          </p>
          <br></br>
          <Link to="/Tutorials" className="earn-cta">Tap to learn more (❗)</Link>
          <br></br>
          <Link to="/games" className="earn-cta">
            Continue with games
          </Link>
        </TiltCard>

        <TiltCard className="rw-card glass-card surveys-card earn-card">
          <h2>📋 Survey Streaks</h2>
          <p>
            Fill surveys when you have a few spare minutes, on the bus, in the bathroom, etc. 
            Great for stacking consistent small hits of <span className="bread-word">bread</span>.
          </p>
          <br></br>
          <Link to="/Tutorials" className="earn-cta">Tap to learn more</Link>
          <br></br>
          <Link to="/surveys" className="earn-cta">
            Continue with surveys
          </Link>
        </TiltCard>

        <TiltCard className="rw-card glass-card receipts-card earn-card">
          <h2>🧾 Magic Receipts</h2>
          <p>
            Turn your grocery runs into even more earnings. Snap a picture, upload,
            and if it matches an active offer - that&apos;s extra{" "}
            <span className="bread-word">bread</span> for you.
          </p>
          <br></br>
          <Link to="/Tutorials" className="earn-cta">Tap to learn more</Link>
          <br></br>
          <Link to="/receipts" className="earn-cta">
            Upload a receipt
          </Link>
        </TiltCard>

        <TiltCard className="rw-card glass-card cashouts-card earn-card">
          <h2>💸 Satisfying Cashouts</h2>
          <p>
            Once you&apos;re happy with your stack, cash out. PayPal, Cash App,
            or donations to vetted charities, all with zero fees.
          </p>
          <br></br>
          <Link to="/Tutorials" className="earn-cta">Tap to learn more</Link>
          <Link to="/rewards" className="earn-cta">
            View rewards & cashouts
          </Link>
        </TiltCard>
      </section>

      {/* REFERRAL & EXTENSION STRIP (LOGGED-IN VIEW) */}
      <section className="referral-section">
        <h3 className="section-heading">Boost your bread even faster</h3>
        <div className="referral-inner glass-card">
          <div className="referral-left">
            <h3>🤝 Invite friends, stack bonuses</h3>
            <p>
              Share your referral code and earn a bonus each time a friend
              joins and starts completing offers. Perfect for Discord servers, group
              chats, and content descriptions.
            </p>
            <br></br>
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
              This feature is still <i>half-baked</i>. Please check back another time.
            </p>
          </div>
        </div>
      </section>

      {/* STRIP */}
      <section className="landing-strip">
        <h2>
          Logged in, cozy, and ready to{" "}
          <span className="bread-word">earn your bread</span>.
        </h2>
        <p>
          ReadyBread is built to feel more like a game than a chore. Pick your
          vibe, games, surveys, receipts, or referrals, Keep stacking
          your bread at your own pace.
        </p>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        © {new Date().getFullYear()} ReadyBread — thanks for being part of the bakery!
      </footer>
    </div>
  );
};

export default Home;
