// src/pages/privacy.tsx
import React from "react";

export const Privacy: React.FC = () => {
  return (
    <main className="rb-content rb-legal-page">
      <h1>ReadyBread Privacy Policy</h1>
      <p><b>Effective Date:</b> November 2025<br />
      <b>Last Updated:</b> November 2025</p>

      <p>
        This Privacy Policy explains how ReadyBread ("we", "us", "our")
        collects, stores, and uses your information when you use our platform
        at https://readybread.xyz. By using ReadyBread, you agree to this
        Privacy Policy.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>1.1 Information You Provide</h3>
      <ul>
        <li>Email address</li>
        <li>Password (securely hashed)</li>
        <li>Username</li>
        <li>Referral code</li>
        <li>Support messages</li>
        <li>Unique device  fingerprint (to detect fraud)</li>
        <li>Ban timestamps, if you are to be banned.</li>
      </ul>

      <h3>1.2 Automatically Collected Data</h3>
      <ul>
        <li>IP address</li>
        <li>Device and browser information</li>
        <li>Country and region</li>
        <li>Activity timestamps</li>
      </ul>

      <h3>1.3 Offerwall Partner Data</h3>
      <p>Offer partners (e.g., BitLabs) may send us:</p>
      <ul>
        <li>Offer IDs</li>
        <li>Reward amounts</li>
        <li>Fraud/quality scores</li>
        <li>Completion timestamps</li>
      </ul>

      <p>We do NOT collect or store sensitive data such as SSNs, bank details, or credit card numbers.</p>

      <h2>2. How We Use Data</h2>
      <ul>
        <li>Create and secure accounts</li>
        <li>Track earnings and offer completions</li>
        <li>Prevent fraud and multi-accounting</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. Data Protection</h2>
      <p>We use HTTPS, Firestore Security Rules, hashed passwords, and anti-fraud systems to protect your data.</p>

      <h2>4. Cookies</h2>
      <p>ReadyBread uses cookies for login, referral tracking, and user experience improvement.</p>

      <h2>5. Third-Party Services</h2>
      <p>We integrate with Firebase, BitLabs, and analytics tools. Each has their own privacy practices. We do not personally hold anything in our databases.</p>

      <h2>6. Data Retention</h2>
      <p>We retain data while your account remains active. You may request account deletion via email.</p>

      <h2>7. Children's Privacy</h2>
      <p>ReadyBread is not intended for users under 13 years old.</p>

      <h2>8. Policy Changes</h2>
      <p>We may update this Privacy Policy. Continued use means you accept the changes.</p>

      <h2>9. Contact</h2>
      <p>Email: contact@readybread.xyz</p>

      <h2>TL;DR Summary</h2>
      <ul>
        <li>We collect basic login info + IP/device for fraud prevention.</li>
        <li>We never sell your data.</li>
        <li>You can delete your account anytime via email.</li>
        <li>Cookies keep the site functional.</li>
      </ul>
    </main>
  );
};
