// src/pages/privacy.tsx
import React from "react";
import "./styles/legal.css";

export const Privacy: React.FC = () => {
  return (
    <main className="legal-wrapper">
      <div className="legal-card">
        <h1 className="legal-title">Privacy Policy</h1>

        <p className="legal-intro">
          <b>Effective Date:</b> November 2025<br />
          <b>Last Updated:</b> November 2025
        </p>

        <p>
          This Privacy Policy explains how ReadyBread (“we”, “us”, “our”)
          collects, uses, and protects your information when you use the platform
          at <a href="https://readybread.xyz">readybread.xyz</a>. By using
          ReadyBread, you agree to the terms described here.
        </p>

        {/* ───────────────────────────────── */}
        {/* 1. Information We Collect */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>1. Information We Collect</h2>

          <h3>1.1 Information You Provide</h3>
          <ul>
            <li>Email address and password (securely hashed).</li>
            <li>Display name and referral code.</li>
            <li>Support messages or appeal submissions.</li>
            <li>Ban timestamps or account status flags, if applicable.</li>
          </ul>

          <h3>1.2 Automatically Collected Data</h3>
          <ul>
            <li>IP address and coarse location (non-precise).</li>
            <li>Device model, browser type, and version.</li>
            <li>Device fingerprints used for anti fraud detection.</li>
            <li>Interaction logs, offer starts, and timestamps.</li>
          </ul>

          <h3>1.3 Offerwall Partner Data</h3>
          <p>Our partners (e.g., AdGem, CPX Research, RevU, AyeT) may send us:</p>
          <ul>
            <li>Offer IDs, reward amounts, and currency values.</li>
            <li>Completion timestamps and event status.</li>
            <li>Fraud or quality scores related to your activity.</li>
            <li>Reversal notices or adjustments for invalid activity.</li>
          </ul>

          <p>
            We do <b>not</b> collect or store sensitive data such as Social
            Security numbers, bank account numbers, credit cards, or government
            IDs.
          </p>
        </section>

        {/* ───────────────────────────────── */}
        {/* 2. How We Use Data */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>2. How We Use Data</h2>
          <ul>
            <li>To create, maintain, and secure your account.</li>
            <li>To track earnings and verify offerwall completions.</li>
            <li>
              To detect and prevent fraud while still allowing shared networks
              (dorms, households, and public Wi-Fi).
            </li>
            <li>To comply with partner, legal, and anti abuse requirements.</li>
          </ul>
        </section>

        {/* ───────────────────────────────── */}
        {/* 3. Data Protection */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>3. Data Protection</h2>
          <p>
            We use HTTPS encryption, Firestore Security Rules, hashed passwords,
            and IP/device reputation tools such as IPQualityScore and GetIPIntel
            to help protect accounts and maintain offerwall integrity.
          </p>
          <p>However, no system can be 100% secure. Use strong passwords and keep your device protected.</p>
        </section>

        {/* ───────────────────────────────── */}
        {/* 4. Cookies */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>4. Cookies</h2>
          <p>
            ReadyBread uses cookies for login sessions, referral tracking,
            analytics, and improving your user experience. Cookies never contain
            sensitive personal data.
          </p>
        </section>

        {/* ───────────────────────────────── */}
        {/* 5. Third-Party Services */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>5. Third-Party Services</h2>
          <p>
            We integrate with Firebase Authentication, Firestore, Cloud
            Functions, AdGem, CPX Research, RevU, AyeT, and analytics tools.
            These services have their own privacy policies and may collect data
            independently when offers are completed.
          </p>
          <p>ReadyBread never processes or stores payment card information.</p>
        </section>

        {/* ───────────────────────────────── */}
        {/* 6. Data Retention */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>6. Data Retention</h2>
          <p>
            We keep your account and earning data as long as your profile
            remains active. You may request permanent deletion by emailing
            <a href="mailto:contact@readybread.xyz"> contact@readybread.xyz</a>.
          </p>
        </section>

        {/* ───────────────────────────────── */}
        {/* 7. Children's Privacy */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>7. Children's Privacy</h2>
          <p>
            ReadyBread is not intended for children under 13. Users aged 13–17
            should have parental consent before using the platform.
          </p>
        </section>

        {/* ───────────────────────────────── */}
        {/* 8. Policy Changes */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Continued use
            of the platform means you accept any updated terms.
          </p>
        </section>

        {/* ───────────────────────────────── */}
        {/* 9. Contact */}
        {/* ───────────────────────────────── */}
        <section className="legal-section">
          <h2>9. Contact</h2>
          <p>Email: contact@readybread.xyz</p>
        </section>
      </div>
    </main>
  );
};

export default Privacy;
