// src/pages/AntiFraud.tsx
import React from "react";
import "./styles/legal.css";

const AntiFraudComponent: React.FC = () => {
  return (
    <main className="legal-wrapper">
      <div className="legal-card">
        <h1 className="legal-title">Anti-Fraud & VPN Policy</h1>

        <p className="legal-intro">
          ReadyBread is built for real people earning real rewards. We use
          multiple layers of protection to keep earnings fair, while allowing
          shared networks such as dorms, families, and campus Wi-Fi.
        </p>

        {/* ─────────────────────────────── */}
        {/* WHAT IS NOT ALLOWED */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>What is not allowed</h2>
          <ul>
            <li>Automated tools, bots, scripts, or survey-farming software.</li>
            <li>Emulators, rooted/jailbroken devices, or spoofed device IDs.</li>
            <li>Multiple accounts per user, household, or device.</li>
            <li>
              VPNs, proxies, Tor, anti-detect browsers, or any IP masking
              service.
            </li>
            <li>Fake data, low-quality survey answers, or fabricated receipts.</li>
            <li>
              Completing offers for others or incentivizing others to complete
              your offers.
            </li>
          </ul>
        </section>

        {/* ─────────────────────────────── */}
        {/* HOW WE ENFORCE */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>How we enforce</h2>
          <ul>
            <li>
              Logged IPs analyzed using IPQualityScore and GetIPIntel for
              fraud patterns.
            </li>
            <li>
              Device fingerprints, hardware checks, and server-side validation.
            </li>
            <li>
              No client-side balance editing; all earnings are securely managed
              on the server.
            </li>
            <li>Manual review of payouts, referrals, and earning activity.</li>
            <li>
              Suspicious patterns may result in reversals or permanent bans.
            </li>
            <li>Dorms, campuses, and shared home networks are allowed.</li>
          </ul>
        </section>

        {/* ─────────────────────────────── */}
        {/* AGE REQUIREMENT */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>Age & eligibility</h2>
          <p>Users must be 16+ (parental consent required under 18).</p>
        </section>

        {/* ─────────────────────────────── */}
        {/* APPEALS */}
        {/* ─────────────────────────────── */}
        <section className="legal-section">
          <h2>Appeals</h2>
          <p>
            If you believe you were flagged incorrectly, email{" "}
            <a href="mailto:contact@readybread.xyz">
              contact@readybread.xyz
            </a>{" "}
            with your UID, device information, and ISP. We will review your case
            using platform logs and partner feedback.
          </p>
        </section>
      </div>
    </main>
  );
};

// Match expected routing exports
export const AntiFraud = AntiFraudComponent;
export default AntiFraudComponent;
