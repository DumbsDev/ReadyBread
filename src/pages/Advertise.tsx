// src/pages/Advertise.tsx
import React, { useEffect, useRef } from "react";
import "./advertising.css"; // NEW FILE
import { GameCard } from "./prefabs/gameCard";
// import { Link } from "react-router-dom";

/* ------------------------------------------
   Tilt Card (lighter version of landing tilt)
------------------------------------------- */
const TiltCard: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = "",
  children,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateX = ((y - rect.height / 2) / rect.height) * -6;
    const rotateY = ((x - rect.width / 2) / rect.width) * 6;

    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  };

  const handleLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "rotateX(0deg) rotateY(0deg) translateY(0)";
  };

  return (
    <div
      ref={cardRef}
      className={`advertise-tilt ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
};

export const Advertise: React.FC = () => {
  /* Reveal on scroll animation */
  useEffect(() => {
    const elements = document.querySelectorAll(".advertise-reveal");
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 }
    );

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="rb-content advertise-wrapper">

      {/* ============================
          HERO
      ============================ */}
      <section className="advertise-hero advertise-reveal">
        <h1 className="advertise-title">Partner With ReadyBread</h1>

        <p className="advertise-subtitle">
          Connect your app, game, survey router, or reward experience with 
          a community designed for engagement. Real users. Real actions. 
          Real revenue.
        </p>

        <div className="advertise-hero-tags">
          <span>🎮 Game Milestones</span>
          <span>🧠 Survey Traffic</span>
          <span>🛒 Cashback Actions</span>
          <span>📲 App Installs</span>
        </div>
      </section>

      {/* ============================
          WHY + WHAT (Tilting Glass Cards)
      ============================ */}
      <section className="advertise-section advertise-reveal">
        <div className="advertise-grid">
          <TiltCard className="advertise-card glass">
            <h3 className="advertise-card-title">Why ReadyBread</h3>
            <ul className="advertise-list">
              <li>Motivated users who complete high effort tasks</li>
              <li>English speaking regions with strong retention</li>
              <li>Strong anti-fraud and device validation logic</li>
              <li>PWA based mobile usage creates daily engagement</li>
              <li>Fast communication and transparent reporting</li>
            </ul>
          </TiltCard>

          <TiltCard className="advertise-card glass">
            <h3 className="advertise-card-title">What We Support</h3>
            <ul className="advertise-list">
              <li>Game actions: level goals, tutorial completion, upgrades</li>
              <li>Survey providers and routers with instant crediting</li>
              <li>App install flows and retention events</li>
              <li>Shopping and receipt verification tasks</li>
              <li>Featured placement and boosted visibility</li>
            </ul>
          </TiltCard>
        </div>
      </section>

      {/* ============================
          HOW IT WORKS (Landing style steps)
      ============================ */}
      <section className="advertise-section advertise-reveal">
        <h2 className="advertise-heading">How a campaign works</h2>

        <div className="advertise-flow-grid">
          <TiltCard className="flow-card">
            <span className="flow-step">1 →</span>
            <h4>Send your offer details</h4>
            <p>
              Provide your tracking link, allowed regions, and the event you want tracked. 
              Examples include level 12 completion, app install plus registration, or a 
              successful survey complete.
            </p>
          </TiltCard>

          <TiltCard className="flow-card">
            <span className="flow-step">2 →</span>
            <h4>Placement and reward structure</h4>
            <p>
              We design the placement style and reward value so the offer performs well 
              while keeping quality high. You may choose featured placement or standard 
              offerwall visibility.
            </p>
          </TiltCard>

          <TiltCard className="flow-card">
            <span className="flow-step">3 →</span>
            <h4>Verification and testing</h4>
            <p>
              We test your postback or webhook to confirm all conversions fire correctly. 
              Test events include install, tutorial complete, purchase, or survey finish.
            </p>
          </TiltCard>

          <TiltCard className="flow-card">
            <span className="flow-step">4 ✓</span>
            <h4>Launch and optimize</h4>
            <p>
              After going live, we watch quality, adjust bids, scale traffic, and tune 
              placements. You get ongoing event reporting and retention insights anytime.
            </p>
          </TiltCard>
        </div>
      </section>
      {/* EXAMPLE CARD */}
        <h4 className="advertise-heading advertise-reveal"><br></br>Example Game</h4>
      <GameCard
        name="Readybread: Rise of Bread"
        blurb="Build a fortress, train troops, and dominate the kingdom."
        description="
          Rise of Bread is a strategic empire builder where players upgrade 
          buildings, conquer zones, and strengthen heroes. Earn rewards as 
          you complete milestones and rise through the ranks.
        "
        thumbnail="/assets/emoji/icon.webp"
        images={[
          '/assets/emoji/icon.webp',
          '/assets/emoji/icon.webp',
          '/assets/emoji/icon.webp'
        ]}
        objectives={[
          { label: 'Complete the tutorial', reward: 0.25, completed: true},
          { label: 'Reach Level 5 HQ', reward: 1.5, completed: false},
          { label: 'Reach Level 10 HQ', reward: 3, completed: false },
          { label: 'Win 3 PvP battles', reward: 5, completed: true }
        ]}
        totalRevenue={9.75}
        cardType="🏰"
        downloadLink=""
      />
      <p></p>
      {/* ============================
          CONTACT CTA
      ============================ */}
      <section className="advertise-section advertise-reveal">
        <TiltCard className="advertise-contact-card glass">
          <h2 className="advertise-heading">Get in touch</h2>

          <p className="contact-subtext">
            Tell us what you're looking for and we will build a campaign that fits. 
            Expect a friendly reply within 72 hours.
          </p>

          <a
            href="mailto:contact@readybread.xyz?subject=ReadyBread%20Advertising"
            className="advertise-btn-primary"
          >
            Email contact@readybread.xyz
          </a>

          <h3 className="contact-subheading">Helpful details to include</h3>

          <ul className="advertise-list">
            <li>Offer or game name with a direct link</li>
            <li>Regions allowed and device restrictions</li>
            <li>Your event goal: install, level reach, subscription trial, registration, or survey complete</li>
            <li>Payout for each conversion</li>
            <li>Any traffic caps or daily limits</li>
            <li>Your webhook or postback URL</li>
            <li>Optional creatives or screenshots</li>
          </ul>
        </TiltCard>
      </section>
    </main>
  );
};

export default Advertise;
