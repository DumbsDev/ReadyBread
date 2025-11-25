// src/pages/privacy.tsx
import React from "react";

export const Privacy: React.FC = () => {
  return (
    <main className="rb-content rb-legal-page">
      <h1>ReadyBread Privacy Policy</h1>
      <p>
        <b>Effective Date:</b> November 2025<br />
        <b>Last Updated:</b> November 2025
      </p>

      <p>
        This Privacy Policy explains how ReadyBread ("we", "us", "our")
        collects, stores, and uses your information when you use our platform
        at https://readybread.xyz. By using ReadyBread, you agree to this
        Privacy Policy.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>1.1 Information You Provide</h3>
      <ul>
        <li>Email address and password (securely hashed).</li>
        <li>Username and referral code.</li>
        <li>Support messages or reports.</li>
        <li>Ban timestamps, if applicable.</li>
      </ul>

      <h3>1.2 Automatically Collected Data</h3>
      <ul>
        <li>IP address and coarse geolocation.</li>
        <li>Device and browser information.</li>
        <li>Device fingerprints for anti-fraud.</li>
        <li>Activity timestamps.</li>
      </ul>

      <h3>1.3 Offerwall Partner Data</h3>
      <p>Offer partners (e.g., BitLabs, CPX, AdGem) may send us:</p>
      <ul>
        <li>Offer IDs and completion status.</li>
        <li>Reward amounts and currency.</li>
        <li>Fraud or quality scores.</li>
        <li>Completion timestamps and device checks.</li>
      </ul>

      <p>We do NOT collect or store sensitive data such as SSNs, bank details, or credit card numbers.</p>

      <h2>2. How We Use Data</h2>
      <ul>
        <li>Create and secure accounts.</li>
        <li>Track earnings and offer completions.</li>
        <li>Detect and reduce fraud/automation while allowing shared networks (dorms/households).</li>
        <li>Comply with partner and legal requirements.</li>
      </ul>

      <h2>3. Data Protection</h2>
      <p>
        We use HTTPS, Firestore Security Rules, hashed passwords, and light-touch IP/device reputation checks
        (including IPQualityScore / GetIPIntel) to protect your data and the integrity of our offerwalls.
      </p>

      <h2>4. Cookies</h2>
      <p>ReadyBread uses cookies for login sessions, referral tracking, and user experience improvement.</p>

      <h2>5. Third-Party Services</h2>
      <p>
        We integrate with Firebase, BitLabs, CPX Research, AdGem, and analytics tools. Each has their own privacy practices.
        We do not personally hold payment card data.
      </p>

      <h2>6. Data Retention</h2>
      <p>We retain data while your account remains active. You may request account deletion via email.</p>

      <h2>7. Children's Privacy</h2>
      <p>ReadyBread is not intended for users under 13 years old. Users 13-17 should have parental consent.</p>

      <h2>8. Policy Changes</h2>
      <p>We may update this Privacy Policy. Continued use means you accept the changes.</p>

      <h2>9. Contact</h2>
      <p>Email: contact@readybread.xyz</p>

      <h2>TL;DR Summary</h2>
      <ul>
        <li>We collect basic login info + IP/device for fraud prevention.</li>
        <li>We never sell your data.</li>
        <li>VPN/proxy use may reduce offer availability; shared IPs are allowed.</li>
        <li>You can delete your account anytime via email.</li>
      </ul>
    </main>
  );
};
