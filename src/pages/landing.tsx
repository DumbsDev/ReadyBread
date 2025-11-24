import React, { useRef } from "react";
import { Link } from "react-router-dom";
import "../landing.css";

interface TiltCardProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Medium parallax tilt card (Opera GX style).
 */
const TiltCard: React.FC<TiltCardProps> = ({ className = "", children }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left; // 0 -> width
    const y = e.clientY - rect.top; // 0 -> height

    const midX = rect.width / 2;
    const midY = rect.height / 2;

    // Medium tilt
    const rotateX = ((y - midY) / midY) * -8; // top/down tilt
    const rotateY = ((x - midX) / midX) * 8; // left/right tilt

    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "rotateX(0deg) rotateY(0deg) translateY(0px)";
  };

  return (
    <div
      ref={cardRef}
      className={`tilt-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
};

export const Landing: React.FC = () => {
  return (
    <div className="landing-container">
      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <h1 className="landing-title">ReadyBread</h1>
          <h2 className="landing-slogan">
            Ready to earn some <span className="bread-word">Bread?</span>
          </h2>

          {/* Scrolling emoji strip */}
          <div className="emoji-strip">
            <div className="emoji-track">
              {Array.from({ length: 24 }).map((_, idx) => (
                <img
                  key={24 + idx}
                  src="/assets/emoji/icon.png"
                  alt="Bread icon"
                  className="emoji-icon"
                />
              ))}
            </div>
          </div>

          <p className="landing-subtitle">
            Play games, complete surveys, scan receipts, and cash out straight.
            No points, no fees, no nonsense.
          </p>

          <div className="hero-buttons">
            <Link to="/login" className="btn-primary">
              Sign Up Free
            </Link>
            <Link to="/login" className="btn-secondary">
              I already have an account
            </Link>
          </div>

          <div className="landing-stats-row">
            <div className="stat-chip">
              <span className="stat-label">Payouts from</span>
              <span className="stat-value">$3 — $50.00+</span>
            </div>
            <div className="stat-chip">
              <span className="stat-label">Supported</span>
              <span className="stat-value">Games • Surveys • Receipts • More</span>
            </div>
            <div className="stat-chip">
              <span className="stat-label">Designed to be</span>
              <span className="stat-value">totally user first.</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="feature-grid">
        <TiltCard className="rw-card glass-card games-card earn-card">
          <h2>🎮 Game &amp; App Offers</h2>
          <p>
            Install and play games from partners like BitLabs and AdGem. Hit
            in-game goals and get <span className="bread-word">paid</span>.
          </p>
          <ul className="feature-list">
            <li>Earn <span className="bread-word">hundreds</span> per game.</li>
            <li>Mobile &amp; desktop friendly.</li>
            <li>Tracked in your dashboard.</li>
          </ul>
          <Link to="/games" className="earn-cta">
            Jump into games
          </Link>
        </TiltCard>

        <TiltCard className="rw-card glass-card surveys-card earn-card">
          <h2>📋 Survey Streaks</h2>
          <p>
            Complete high-quality surveys from trusted partners and stack quick
            payouts. Great when you only have a few spare minutes.
          </p>
          <ul className="feature-list">
            <li><span className="bread-word">Hundreds</span> of surveys to choose from.</li>
            <li>Short and long formats available.</li>
            <li>Daily refresh of new surveys.</li>
          </ul>
          <Link to="/surveys" className="earn-cta">
            Browse surveys
          </Link>
        </TiltCard>

        <TiltCard className="rw-card glass-card receipts-card earn-card">
          <h2>🧾 Magic Receipts</h2>
          <p>
            Snap your grocery receipts and earn when items match live offers.
            Stack with your normal shopping and loyalty apps.
          </p>
          <ul className="feature-list">
            <li>Works with common stores.</li>
            <li>Auto-matching via our partners.</li>
            <li>2 seconds to earn <span className="bread-word">extra cash</span></li>.
          </ul>
          <Link to="/receipts" className="earn-cta">
            Scan a receipt
          </Link>
        </TiltCard>

        <TiltCard className="rw-card glass-card cashouts-card earn-card">
          <h2>💸 Satisfying Cashouts</h2>
          <p>
            Cash out to PayPal, Cash App, or donate to charities like UNICEF,
            Red Cross and more. Actual dollars, not mystery tokens.
          </p>
          <ul className="feature-list">
            <li>Low minimums</li>
            <li>Daily processing</li>
            <li>Absolutely <span className="bread-word">zero</span> withdraw fees</li>
          </ul>
        </TiltCard>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-it-works">
        <h3 className="section-heading">How ReadyBread Works</h3>
        <div className="how-grid">
          <TiltCard className="how-card glass-card">
            <span className="step-pill">Step 1</span>
            <h4>Create your free account</h4>
            <p>
              Sign up in just <span className="bread-accent">seconds</span>. Only an email and password required.
            </p>
          </TiltCard>
          <TiltCard className="how-card glass-card">
            <span className="step-pill">Step 2</span>
            <h4>Choose how you earn</h4>
            <p>
              Play <span className="bread-word">games</span>, fill <span className="bread-word">surveys</span>, scan <span className="bread-word">receipts</span>, or explore 
              <span className="bread-word"> partnered offers</span>. Every completed task adds real money to your balance.
            </p>
          </TiltCard>
          <TiltCard className="how-card glass-card">
            <span className="step-pill">Step 3</span>
            <h4>Cash out &amp; repeat</h4>
            <p>
              When you're ready, cash out and watch your balance reset for
              the next grind. Simple, satisfying, and profitable.
            </p>
          </TiltCard>
        </div>
      </section>

      {/* REFERRAL & EXTENSION STRIP */}
      <section className="referral-section">
        <h3 className="section-heading">Earn & Save Even More</h3>
        <div className="referral-inner glass-card">
          <div className="referral-left">
            <h3>🤝 Invite friends, stack bonuses</h3>
            <p>
              Share ReadyBread with friends and earn referral bonuses when they
              start completing offers. Perfect for Discord servers and group
              chats.
            </p>
          </div>
          <div className="referral-right">
            <h4>🌎 Browser Extension</h4>
            <p>
              Turn every new tab into a ReadyBread hub. Quick access to offers,
              your balance, and a one-time install bonus when you link it to
              your account.
            </p>
          </div>
        </div>
      </section>

      {/* STRIP */}
      <section className="landing-strip">
        <h2>Trusted. Fast. Modern. <span className="bread-accent">Beautiful</span>.</h2>
        <p>
          It's important to be functional, but its also important to look good.
          <br></br>Just another reason ReadyBread.xyz is <i>better</i>.
        </p>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        © {new Date().getFullYear()} ReadyBread - Ready to earn some Bread?
      </footer>
    </div>
  );
};
