// src/pages/Advertise.tsx
import React from "react";

export const Advertise: React.FC = () => {
  return (
    <main className="rb-content theme-surveys">
      <section className="earn-shell">
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">Advertise With ReadyBread</h2>
            <p className="rb-section-sub">
              Reach motivated gamers, survey-takers, and deal hunters. We can run campaigns, influencer placements,
              and custom mini-events for your product.
            </p>
          </div>
        </div>

        <div className="proof-grid">
          <div className="rb-card modern-card">
            <h3>Why partner with us</h3>
            <ul className="proof-list">
              <li>Real users with daily activity.</li>
              <li>US/CA-heavy audience with low bounce rate.</li>
              <li>Server-side validation to keep fraud low.</li>
              <li>Mobile-first UX and PWA for repeat engagement.</li>
            </ul>
          </div>

          <div className="rb-card modern-card">
            <h3>What we offer</h3>
            <ul className="proof-list">
              <li>Offerwall placement on our custom offerwall.</li>
              <li>Sponsored cards on dashboard and earn pages.</li>
              <li>In-app announcements, and quests.</li>
              <li>Social media announcements and social proof posts.</li>
            </ul>
          </div>

          <div className="rb-card modern-card">
            <h3>Who uses ReadyBread</h3>
            <ul className="proof-list">
              <li>Mobile gamers looking for milestone rewards.</li>
              <li>Survey takers who care about quick cashouts.</li>
              <li>Grocery shoppers submitting receipts.</li>
              <li>Referral-friendly communities (Discord, TikTok).</li>
            </ul>
          </div>
        </div>

        <div className="rb-card modern-card">
          <h3>Get in touch</h3>
          <p className="rb-section-sub">
            Tell us about your goals, budget, and preferred pricing model (CPA, CPL, rev-share, or fixed).
          </p>
          <p>
            Email <a href="mailto:contact@readybread.xyz" id="contact">contact@readybread.xyz</a> with:
          </p>
          <ul className="proof-list">
            <li>Your company/offer name and landing URL.</li>
            <li>Desired GEOs and device types.</li>
            <li>Conversion definition and payout.</li>
            <li>Creative assets (if available).</li>
          </ul>
        </div>
      </section>
    </main>
  );
};

export default Advertise;
