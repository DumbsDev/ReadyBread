// src/pages/earningdisclaimer.tsx
import React from "react";
import "./styles/legal.css";

export const EarningsDisclaimer: React.FC = () => {
  return (
    <main className="legal-wrapper">
      <div className="legal-card">
        <h1 className="legal-title">Earnings Disclaimer</h1>

        <p className="legal-intro">
          ReadyBread provides access to surveys, games, apps, tasks, and
          offerwall rewards provided by third party partners. Individual
          earnings vary and are never guaranteed. All rewards depend on partner
          approval, quality checks, device conditions, and account integrity.
        </p>

        {/* ─────────────────────────────── */}
        {/* 1. No Guaranteed Earnings */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>1. No Guaranteed Earnings</h2>
          <p>
            Earnings depend on many factors including partner availability,
            your geographic location, your device, survey quality, anti fraud
            checks, and general user behavior. You may complete an activity
            without receiving payment if partners decline or reverse credit.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 2. Partner Control */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>2. Partner Control</h2>
          <p>Third party providers may:</p>
          <ul>
            <li>Approve or deny completions</li>
            <li>Adjust, reduce, or reverse payouts</li>
            <li>Change offer availability or remove offers entirely</li>
            <li>Flag activity as fraudulent or low quality</li>
          </ul>

          <p>
            These decisions are outside ReadyBread’s control. We cannot issue or
            restore credit when a partner denies or reverses a completion.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 3. Balance Is Not Cash */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>3. Balance Is Not Cash</h2>
          <p>
            Your ReadyBread balance represents pending rewards only. It becomes
            real money or gift card value only after manual review and payout
            approval. Reversed or denied offers may reduce the displayed balance.
          </p>

          <p>
            Accounts permanently banned for fraud or abuse will lose all earned
            balance and cannot withdraw it.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 4. Fraud and Quality Enforcement */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>4. Fraud and Quality Enforcement</h2>
          <p>
            Rewards may be denied, adjusted, or reversed if partners or
            internal systems detect:
          </p>
          <ul>
            <li>Multiple accounts, shared devices, or fake identities</li>
            <li>VPNs, proxies, Tor, or IP masking tools</li>
            <li>Low quality or dishonest survey answers</li>
            <li>Automation, bots, scripts, or emulators</li>
            <li>Behavior flagged as fraud by partner anti abuse systems</li>
          </ul>

          <p>
            Actions taken by partners override ReadyBread’s internal
            verification.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 5. Charity Withdrawal Policy */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>5. Charity Withdrawal Policy</h2>
          <p>
            If you choose to donate your earnings to a charity, ReadyBread will
            contribute an additional 5% on top of your donation. Donations are
            made under the ReadyBread name and cannot be claimed as personal tax
            deductions by the user.
          </p>
        </section>
      </div>
    </main>
  );
};

export default EarningsDisclaimer;
