// src/pages/tos.tsx
import React from "react";
import "./styles/legal.css";

export const TOS: React.FC = () => {
  return (
    <main className="legal-wrapper">
      <div className="legal-card">
        <h1 className="legal-title">Terms of Service</h1>

        <p className="legal-intro">
          <b>Effective Date:</b> November 2025<br />
          <b>Last Updated:</b> November 2025
        </p>

        <p className="legal-intro">
          Welcome to ReadyBread. By creating an account or using this website,
          you agree to these Terms. If you do not agree, please stop using the
          platform.
        </p>

        {/* ─────────────────────────────── */}
        {/* 1. Eligibility */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>1. Eligibility</h2>
          <ul>
            <li>You must be at least 16 years old to use ReadyBread.</li>
            <li>Users under 18 must have parental permission.</li>
            <li>
              You must provide accurate information and maintain a verified
              email.
            </li>
            <li>
              Shared networks like dorms and households are allowed. Multiple
              accounts per person are not.
            </li>
          </ul>
        </section>

        {/* ─────────────────────────────── */}
        {/* 2. Accounts */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>2. Accounts</h2>
          <ul>
            <li>You are responsible for your password and device security.</li>
            <li>
              You are responsible for all activity performed under your
              account.
            </li>
            <li>
              We may limit, suspend, or terminate accounts that violate these
              Terms or raise fraud concerns.
            </li>
          </ul>
        </section>

        {/* ─────────────────────────────── */}
        {/* 3. Earnings & Rewards */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>3. Earnings and Rewards</h2>
          <ul>
            <li>
              Earnings come from third party partners including surveys, apps,
              games, offers, and receipts.
            </li>
            <li>
              All rewards require partner approval and may be reversed if
              partners revoke or adjust credit.
            </li>
            <li>
              Your ReadyBread balance is virtual until manually approved for
              payout.
            </li>
            <li>
              We may delay, deny, or reverse payouts if fraud, abuse, or low
              quality activity is detected.
            </li>
          </ul>
        </section>

        {/* ─────────────────────────────── */}
        {/* 4. Fraud Prevention */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>4. Fraud Prevention</h2>
          <ul>
            <li>
              We use IP reputation services, device fingerprinting, and
              server-side validation to monitor activity.
            </li>
            <li>
              VPNs, proxies, Tor, and anti-detect browsers are prohibited.
            </li>
            <li>
              Shared networks are allowed as long as each person has a genuine
              individual account.
            </li>
            <li>
              Partners may reverse rewards for low quality answers, duplicate
              accounts, or suspicious behavior.
            </li>
            <li>
              Serious or repeated violations can lead to permanent bans and
              forfeited balances.
            </li>
          </ul>
        </section>

        {/* ─────────────────────────────── */}
        {/* 5. Referral Program */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>5. Referral Program</h2>
          <p>
            Referral rewards apply only when a new user signs up using your
            referral code and engages legitimately. Fake referrals,
            self-referrals, duplicate accounts, or incentivized signups are not
            allowed and may result in removal of referral earnings or account
            suspension.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 6. Prohibited Activities */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>6. Prohibited Activities</h2>
          <ul>
            <li>Using bots, scripts, emulators, or automation of any kind.</li>
            <li>Using VPNs, proxies, or IP masking tools.</li>
            <li>Multi-accounting, self-referring, or identity manipulation.</li>
            <li>Submitting dishonest or low quality survey answers.</li>
            <li>
              Attempting to modify the platform, rewards, receipts, or backend.
            </li>
            <li>
              Interfering with ReadyBread operations, partners, or other users.
            </li>
          </ul>
        </section>

        {/* ─────────────────────────────── */}
        {/* 7. Suspension or Termination */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>7. Suspension or Termination</h2>
          <p>
            We may suspend, limit, or terminate your account if there is a
            violation of these Terms, evidence of abuse, or partner feedback
            indicating fraud. Suspended or banned accounts may forfeit pending
            balances.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 8. Warranty Disclaimer */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>8. Warranty Disclaimer</h2>
          <p>
            ReadyBread is provided on an "as is" basis. We do not guarantee
            earnings, uptime, offer availability, or accuracy of partner
            information.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 9. Limitation of Liability */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>9. Limitation of Liability</h2>
          <p>
            ReadyBread is not responsible for reversed offers, partner
            decisions, data loss, lost earnings, or damages resulting from use
            of the platform. All payouts depend on partner confirmation and our
            review.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 10. Changes to Terms */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>10. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of
            ReadyBread means you accept the most recent version.
          </p>
        </section>

        {/* ─────────────────────────────── */}
        {/* 11. Contact */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>11. Contact</h2>
          <p>
            Email us at{" "}
            <a href="mailto:contact@readybread.xyz">contact@readybread.xyz</a>
          </p>
        </section>
      </div>
    </main>
  );
};

export default TOS;
