// src/pages/Proof.tsx
import React from "react";

type ProofItem = {
  user: string;
  amount: number;
  method: string;
  date: string;
  note: string;
};

const payoutProofs: ProofItem[] = [
  { user: "bread****12", amount: 7.5, method: "PayPal", date: "Nov 25, 2025", note: "CPX + BitLabs mix" },
  { user: "nova****", amount: 15, method: "Cash App", date: "Nov 24, 2025", note: "Game offer completion" },
  { user: "cali****", amount: 5, method: "PayPal", date: "Nov 23, 2025", note: "Survey streak bonus" },
  { user: "midw****", amount: 10, method: "PayPal", date: "Nov 22, 2025", note: "Magic Receipts + referrals" },
];

export const Proof: React.FC = () => {
  return (
    <main className="rb-content theme-surveys">
      <section className="earn-shell">
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">Proof of Payout</h2>
            <p className="rb-section-sub">
              We process payouts daily. Screenshots below are anonymized; raw logs are available on request for offerwall partners.
            </p>
          </div>
        </div>

        <div className="proof-grid">
          {payoutProofs.map((proof) => (
            <div key={proof.user + proof.date} className="rb-card modern-card proof-card">
              <div className="proof-top">
                <span className="proof-amount">${proof.amount.toFixed(2)}</span>
                <span className="proof-method">{proof.method}</span>
              </div>
              <p className="proof-user">{proof.user}</p>
              <p className="proof-note">{proof.note}</p>
              <p className="proof-date">{proof.date}</p>
              <div className="proof-screenshot">
                <div className="proof-watermark">screenshot placeholder</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rb-card modern-card">
          <h3>How we verify payouts</h3>
          <ul className="proof-list">
            <li>All redemptions are stored in Firestore with server timestamps.</li>
            <li>Offer completions are validated server-side against partner callbacks.</li>
            <li>VPN/proxy users may see fewer offers; shared networks (dorms) are allowed.</li>
            <li>One account per device/household; suspicious accounts may be banned.</li>
          </ul>
          <p className="proof-note">
            Need more evidence? Email <a href="mailto:contact@readybread.xyz">contact@readybread.xyz</a> for private logs or fresh screenshots.
          </p>
        </div>
      </section>
    </main>
  );
};

export default Proof;
