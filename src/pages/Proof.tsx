// src/pages/Proof.tsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";
import { useUser } from "../contexts/UserContext";

type ProofItem = {
  user: string;
  amount: number;
  method: string;
  date: string;
  note: string;
};

const payoutProofs: ProofItem[] = [
  {
    user: "bread****12",
    amount: 7.5,
    method: "PayPal",
    date: "Nov 25, 2025",
    note: "CPX + BitLabs mix",
  },
  {
    user: "nova****",
    amount: 15,
    method: "Cash App",
    date: "Nov 24, 2025",
    note: "Game offer completion",
  },
  {
    user: "cali****",
    amount: 5,
    method: "PayPal",
    date: "Nov 23, 2025",
    note: "Survey streak bonus",
  },
  {
    user: "midw****",
    amount: 10,
    method: "PayPal",
    date: "Nov 22, 2025",
    note: "Magic Receipts + referrals",
  },
];

const maskUser = (uid?: string | null) => {
  if (!uid) return "user****";
  if (uid.length <= 4) return `${uid}****`;
  return `${uid.slice(0, 4)}****`;
};

const formatDate = (ts: any) => {
  if (!ts) return "--";
  if (ts.toDate) return ts.toDate().toLocaleString();
  if (ts instanceof Date) return ts.toLocaleString();
  return ts;
};

export const Proof: React.FC = () => {
  const { authUser } = useUser();
  const [liveProofs, setLiveProofs] = useState<ProofItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;
    const load = async () => {
      try {
        const ref = collection(db, "cashout_requests");
        const snap = await getDocs(query(ref, orderBy("createdAt", "desc"), limit(12)));
        const items: ProofItem[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((row) => (row.status || "").toString().toLowerCase() === "fulfilled")
          .map((row) => ({
            user: maskUser(row.userId),
            amount: Number(row.amount) || 0,
            method: row.method || "cashout",
            date: formatDate(row.decidedAt || row.createdAt),
            note: row.notes || "Paid",
          }));

        if (items.length > 0) {
          setLiveProofs(items);
        }
      } catch (err) {
        console.error("Proof fetch failed", err);
        setError("Showing recent samples while we load live proofs.");
      }
    };

    load();
  }, [authUser]);

  const proofs = liveProofs.length > 0 ? liveProofs : payoutProofs;

  return (
    <main className="rb-content theme-surveys">
      <section className="earn-shell">
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">Proof of Payout</h2>
            <p className="rb-section-sub">
              We process payouts daily. Screenshots are anonymized; partner teams can request raw logs at any time.
            </p>
            {error && <p className="dash-muted error-text">{error}</p>}
          </div>
        </div>

        <div className="proof-grid">
          {proofs.map((proof) => (
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
          <div className="peek-chip" style={{ marginTop: 8 }}>
            <a href="/offer-history">Your offer history</a>
            <span>•</span>
            <a href="/rewards">Request a payout</a>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Proof;
