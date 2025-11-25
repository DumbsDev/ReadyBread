// src/pages/AntiFraud.tsx
import React from "react";

export const AntiFraud: React.FC = () => {
  return (
    <main className="rb-content rb-legal-page">
      <h1>Anti-Fraud &amp; VPN Policy</h1>
      <p>
        ReadyBread is built for real people earning real rewards. We focus on education and light-touch checks
        so roommates or dorms can play together without IP blocks.
      </p>

      <h2>What is not allowed</h2>
      <ul>
        <li>Automated scripts, bots, or survey-farming tools.</li>
        <li>Emulators, rooted device exploits, or spoofed device IDs.</li>
        <li>Fake data, low-quality survey answers, or fabricated receipts.</li>
      </ul>

      <h2>How we enforce</h2>
      <ul>
        <li>IP reputation checks via IPQualityScore/GetIPIntel with warnings (no IP blocking for dorms/roommates).</li>
        <li>Device fingerprints and server-side validation; balances cannot be edited client-side.</li>
        <li>Manual review of payout requests and referral activity.</li>
        <li>Serious automation/fraud can still be banned, but shared networks are allowed.</li>
      </ul>

      <h2>Age & eligibility</h2>
      <p>Users must be 13+ (with parental consent under 18). Shared Wi-Fi/dorm usage is allowed.</p>

      <h2>Appeals</h2>
      <p>
        If you believe you were flagged in error, email{" "}
        <a href="mailto:contact@readybread.xyz">contact@readybread.xyz</a> with your UID, device,
        and ISP. We will review logs and partner feedback.
      </p>
    </main>
  );
};

export default AntiFraud;
