// src/pages/tos.tsx
import React from "react";

export const TOS: React.FC = () => {
  return (
    <main className="rb-content rb-legal-page">
      <h1>ReadyBread Terms of Service</h1>
      <p>
        <b>Effective Date:</b> November 2025<br />
        <b>Last Updated:</b> November 2025
      </p>

      <p>
        Welcome to ReadyBread. By creating an account or using this website,
        you agree to these Terms. If you do not agree, do not use ReadyBread.
      </p>

      <h2>1. Eligibility</h2>
      <ul>
        <li>You must be at least 13 years old. Users under 18 must have parental consent.</li>
        <li>Provide accurate information and maintain a verified email.</li>
        <li>Multiple users can access ReadyBread from the same network (e.g., dorms).</li>
      </ul>

      <h2>2. Accounts</h2>
      <ul>
        <li>You are responsible for your login security and device safety.</li>
        <li>You are responsible for all actions under your account.</li>
        <li>We may suspend or terminate accounts that violate these Terms.</li>
      </ul>

      <h2>3. Earnings, Rewards, and Balance</h2>
      <ul>
        <li>Rewards come from surveys, games, receipts, and referrals provided by third parties.</li>
        <li>Rewards are credited only after partner verification and may be reversed.</li>
        <li>Your ReadyBread balance is not cash until manually approved for payout.</li>
        <li>Payout requests may be denied if fraud or quality issues are suspected.</li>
      </ul>

      <h2>4. Fraud Prevention</h2>
      <ul>
        <li>We monitor for automation and fraud but do not block shared IPs (dorms/households are fine).</li>
        <li>VPNs/proxies may reduce offer availability; you can still proceed, but quality checks may occur.</li>
        <li>We use device fingerprints, IP reputation checks, and server-side validations to flag abusive patterns.</li>
        <li>Severe or repeated fraud/automation can still lead to bans or forfeiture.</li>
      </ul>

      <h2>5. Referral Program</h2>
      <p>Referral rewards apply only when a new user signs up and participates legitimately. Duplicate, fake, or self-referrals are prohibited.</p>

      <h2>6. Prohibited Activities</h2>
      <ul>
        <li>Using bots, scripts, automation, or emulators.</li>
        <li>Using VPNs/proxies to manipulate geo or payout.</li>
        <li>Multi-accounting or self-referring.</li>
        <li>Submitting low-quality or dishonest survey answers.</li>
        <li>Attempting to alter balances, receipts, or backend behavior.</li>
        <li>Interfering with ReadyBread operations or partners.</li>
      </ul>

      <h2>7. Suspension or Termination</h2>
      <p>We may suspend or terminate access for violations, suspected fraud, or abuse. Bans may result in forfeiture of balances.</p>

      <h2>8. Warranty Disclaimer</h2>
      <p>ReadyBread is provided "as is." We do not guarantee earnings, uptime, accuracy, or partner availability.</p>

      <h2>9. Limitation of Liability</h2>
      <p>
        ReadyBread is not liable for reversed offers, lost rewards, partner issues, data loss, or damages arising from use of the site.
        Payouts are at our discretion and depend on partner confirmation.
      </p>

      <h2>10. Changes to Terms</h2>
      <p>We may modify these Terms at any time. Continued use indicates acceptance of updates.</p>

      <h2>11. Contact</h2>
      <p>Email: contact@readybread.xyz</p>

      <h2>TL;DR Summary</h2>
      <ul>
        <li>Do not cheat, multi-account, or use VPNs/proxies.</li>
        <li>Offer approvals come from partners, not us.</li>
        <li>We may ban or forfeit balances when fraud is suspected.</li>
        <li>Your balance is not cash until manually paid out.</li>
      </ul>
    </main>
  );
};
