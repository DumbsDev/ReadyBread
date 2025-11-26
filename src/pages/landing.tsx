import React, { useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import "../landing.css";
import { useUser } from "../contexts/UserContext";

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

const payoutProofs = [
  { user: "Sle*******", amount: 7.21, method: "Cash App", date: "Nov 25, 2025", note: "Surveys" },
  { user: "Mik********", amount: 3, method: "Cash App", date: "Nov 24, 2025", note: "Referrals and surveys" },
  { user: "Wai********", amount: 3, method: "Donation", date: "Nov 23, 2025", note: "Surveys" },
  { user: "The***********", amount: 11.32, method: "PayPal", date: "Nov 22, 2025", note: "Surveys" },
];

export const Landing: React.FC = () => {
  const { user, authUser } = useUser();

  // Simple redirect: if logged in, go home; otherwise show landing.
  if (authUser || user) return <Navigate to="/home" replace />;

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
              <span className="stat-value">$3 - $50.00+</span>
            </div>
            <div className="stat-chip">
              <span className="stat-label">Supported</span>
              <span className="stat-value">Games • Surveys • Receipts • More</span>
            </div>
            <div className="stat-chip">
              <span className="stat-label">Designed to be</span>
              <span className="stat-value">Totally User First.</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="feature-grid">
        <TiltCard className="rw-card glass-card games-card earn-card">
          <h2>🎮 Game &amp; App Offers</h2>
          <p>
            Install and play games from our trust partners. Hit
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
            Cash out to PayPal, Cash App, or donate to charities like St. Judes,
            Red Cross and more. Actual dollars, not "points".
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
            <h4>Become a Breadwinner for free</h4>
            <p>
              Sign up in just <span className="bread-accent">seconds</span>. Earn forever.
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

      {/* TRUST & SOCIAL PROOF */}
      <section className="trust-section">
        <h3 className="section-heading">Built for partners and real players</h3>
        <div className="trust-grid">
          <TiltCard className="trust-card glass-card">
            <h4>Proof of payout</h4>
            <p>See anonymized payout screenshots and logs. We process cashouts daily.</p>
            <a href="#proof" className="earn-cta">
              Jump to proof
            </a>
          </TiltCard>
          <TiltCard className="trust-card glass-card">
            <h4>Anti-fraud baked in</h4>
            <p>Friendly checks with warnings (no IP blocks), plus server-side validation for offer quality.</p>
            <Link to="/anti-fraud" className="earn-cta">
              Read policy
            </Link>
          </TiltCard>
          <TiltCard className="trust-card glass-card">
            <h4>Community receipts</h4>
            <p>Active socials, sharing tips and user experiences.</p>
            <div className="social-links">
              <a href="https://x.com/@Ready_Bread" target="_blank" rel="noreferrer">
                X (formerly known as twitter)
              </a>
              <a href="https://tiktok.com/@ready_bread" target="_blank" rel="noreferrer">
                TikTok
              </a>
              <a href="https://instagram.com/@ready_bread" target="_blank" rel="noreferrer">
                Instagram
              </a>
              <a href="#proof">Recent payouts</a>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* PROOF EMBED */}
      <section className="partners-strip" id="proof">
        <div className="partners-inner glass-card">
          <h3>Proof of payout (live snaps)</h3>
          <p className="partner-note">We pay out daily. Usernames are blurred; full logs available to partners on request.</p>
          <div className="proof-grid">
            {payoutProofs.map((proof) => (
              <div key={proof.user + proof.date} className="rb-card modern-card proof-card">
                <div className="proof-top">
                  <span className="proof-amount">${proof.amount.toFixed(2)}</span>
                  <span className="proof-method">{proof.method}</span>
                </div>
                <p className="proof-user">{proof.user}</p>
                <p className="proof-note">{proof.note}</p>
                <p className="proof-date">{proof.date}</p>
                <div className="proof-screenshot">
                  <div className="proof-watermark">RECENT PAYOUT</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNER LINEUP */}
      <section className="partners-strip">
        <div className="partners-inner glass-card">
          <h3>Offerwall lineup ready for approval</h3>
          <div className="partner-badges">
            <span>Major offerwalls are either already implemented, or ready to be at any moment.</span>
          </div>
          <p className="partner-note">
            Shared Wi-Fi and dorm networks are allowed. VPN/proxy use may reduce offer availability. We share fraud logs with partners on request.
          </p>
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
              your account (In-progress).
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
