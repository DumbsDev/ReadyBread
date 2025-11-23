// src/pages/Admin.tsx
import React, { useEffect, useState } from "react";
import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  serverTimestamp,
  QueryDocumentSnapshot,
  doc,
  getDoc,
  limit,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { useUser } from "../contexts/UserContext";

type CashoutStatus = "pending" | "fulfilled" | "denied";

interface CashoutRow {
  id: string;
  type: "cashout" | "donation";
  userId: string;
  amount: number;
  method: string;
  status: CashoutStatus | string;
  createdAt?: any;
  paypalEmail?: string | null;
  cashappTag?: string | null;
  denialReason?: string | null;
  refunded?: boolean;
  ref: QueryDocumentSnapshot<unknown, DocumentData>["ref"];

  charityId?: string | null;
  charityName?: string | null;
  receiptEmail?: string | null;
  readybreadMatch?: number | null;

  userCreatedAt?: any;
  userEmail?: string | null;
  username?: string | null;

  suspiciousScore?: number;
  suspiciousReasons?: string[];
}

type FilterTab = "pending" | "fulfilled" | "denied" | "all";
type ActionType = "fulfill" | "deny" | null;

export const Admin: React.FC = () => {
  const { user, isAdmin } = useUser();

  const [cashouts, setCashouts] = useState<CashoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterTab>("pending");

  const [lookupUid, setLookupUid] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupProfile, setLookupProfile] = useState<DocumentData | null>(null);
  const [lookupPayouts, setLookupPayouts] = useState<CashoutRow[]>([]);

  const [actionRow, setActionRow] = useState<CashoutRow | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [denialReason, setDenialReason] = useState("");
  const [refundOnDeny, setRefundOnDeny] = useState(true);
  const [actionSaving, setActionSaving] = useState(false);

  const parseAmount = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const mapCashoutDoc = (
    docSnap: QueryDocumentSnapshot<unknown, DocumentData>,
    fallbackUid = "unknown"
  ): CashoutRow => {
    const data = (docSnap.data() || {}) as Record<string, any>;
    return {
      id: docSnap.id,
      type: "cashout",
      userId: typeof data.userId === "string" ? data.userId : fallbackUid,
      amount: parseAmount(data.amount),
      method: typeof data.method === "string" ? data.method : "unknown",
      status:
        typeof data.status === "string" ? (data.status as CashoutStatus) : "pending",
      createdAt: data.createdAt,
      paypalEmail:
        typeof data.paypalEmail === "string" ? data.paypalEmail : null,
      cashappTag: typeof data.cashappTag === "string" ? data.cashappTag : null,
      denialReason:
        typeof data.denialReason === "string" ? data.denialReason : null,
      refunded: Boolean(data.refunded),
      ref: docSnap.ref,
    };
  };

  const mapDonationDoc = (
    docSnap: QueryDocumentSnapshot<unknown, DocumentData>,
    fallbackUid = "unknown"
  ): CashoutRow => {
    const data = (docSnap.data() || {}) as Record<string, any>;

    return {
      id: docSnap.id,
      type: "donation",
      userId: typeof data.userId === "string" ? data.userId : fallbackUid,
      amount: parseAmount(data.amount),
      method: data.charityName || "Donation",
      status:
        typeof data.status === "string" ? (data.status as CashoutStatus) : "pending",
      createdAt: data.createdAt,
      paypalEmail: null,
      cashappTag: null,
      denialReason:
        typeof data.denialReason === "string" ? data.denialReason : null,
      refunded: Boolean(data.refunded),
      ref: docSnap.ref,
      charityId: typeof data.charityId === "string" ? data.charityId : null,
      charityName: typeof data.charityName === "string" ? data.charityName : null,
      receiptEmail:
        typeof data.receiptEmail === "string" ? data.receiptEmail : null,
      readybreadMatch:
        typeof data.readybreadMatch === "number"
          ? data.readybreadMatch
          : Number.isFinite(Number(data.readybreadMatch))
          ? Number(data.readybreadMatch)
          : null,
    };
  };

  /* -------------------------------------------------------
     LOAD REQUESTS
  ------------------------------------------------------- */
  useEffect(() => {
    const load = async () => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cashRef = collection(db, "cashout_requests");
        const donRef = collection(db, "donation_requests");

        const fetchAll = (r: any) =>
          getDocs(query(r, orderBy("createdAt", "desc")));

        const [cashSnap, donSnap] = await Promise.all([
          fetchAll(cashRef),
          fetchAll(donRef),
        ]);

        const cashRows = cashSnap.docs.map((d) => mapCashoutDoc(d));
        const donRows = donSnap.docs.map((d) => mapDonationDoc(d));

        let combined = [...cashRows, ...donRows].sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });

        if (filterStatus !== "all") {
          combined = combined.filter(
            (r) => r.status.toString().toLowerCase() === filterStatus
          );
        }

        setCashouts(await enrichRows(combined));
      } catch (err) {
        console.error(err);
        setError("Failed to load requests.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isAdmin, filterStatus]);

  /* -------------------------------------------------------
     ENRICH WITH USER DATA + SUSPICION
  ------------------------------------------------------- */
  const enrichRows = async (rows: CashoutRow[]) => {
    const uidSet = new Set(rows.map((r) => r.userId));
    const uidArr = Array.from(uidSet);

    const userData: Record<string, any> = {};

    await Promise.all(
      uidArr.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) userData[uid] = snap.data();
        } catch {}
      })
    );

    const now = Date.now();

    return rows.map((r) => {
      const u = userData[r.userId];
      const reasons: string[] = [];
      let score = 0;

      if (!u) {
        reasons.push("No user profile");
        score += 2;
      } else {
        const createdAt = u.createdAt?.toDate?.();
        if (createdAt) {
          const hours = (now - createdAt.getTime()) / (1000 * 60 * 60);
          if (hours < 24) {
            reasons.push("Account <24h old");
            score += 2;
          }
        }

        if (!u.username || !u.email) {
          reasons.push("Missing username/email");
          score += 1;
        }
      }

      if (r.amount >= 15) {
        reasons.push("High payout");
        score += 1;
      }

      if (r.status === "denied") {
        reasons.push("Previously denied");
        score += 1;
      }

      return {
        ...r,
        userCreatedAt: u?.createdAt,
        userEmail: u?.email || null,
        username: u?.username || null,
        suspiciousScore: score,
        suspiciousReasons: reasons,
      };
    });
  };

  /* -------------------------------------------------------
     USER LOOKUP
  ------------------------------------------------------- */
  const handleLookup = async () => {
    const uid = lookupUid.trim();
    if (!uid) {
      setLookupError("Enter UID");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupProfile(null);
    setLookupPayouts([]);

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setLookupError("User not found");
        setLookupLoading(false);
        return;
      }

      setLookupProfile({ id: uid, ...snap.data() });

      const cashSnap = await getDocs(
        query(
          collection(db, "cashout_requests"),
          where("userId", "==", uid),
          orderBy("createdAt", "desc"),
          limit(20)
        )
      );

      const donSnap = await getDocs(
        query(
          collection(db, "donation_requests"),
          where("userId", "==", uid),
          orderBy("createdAt", "desc"),
          limit(20)
        )
      );

      const rows = [
        ...cashSnap.docs.map((d) => mapCashoutDoc(d, uid)),
        ...donSnap.docs.map((d) => mapDonationDoc(d, uid)),
      ].sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });

      setLookupPayouts(rows);
    } catch (err) {
      console.error(err);
      setLookupError("Error loading user data");
    } finally {
      setLookupLoading(false);
    }
  };

  /* -------------------------------------------------------
     ACTION MODAL
  ------------------------------------------------------- */
  const openModal = (row: CashoutRow, type: ActionType) => {
    setActionRow(row);
    setActionType(type);
    setDenialReason("");
    setRefundOnDeny(true);
  };

  const closeModal = () => {
    setActionRow(null);
    setActionType(null);
    setDenialReason("");
    setRefundOnDeny(true);
    setActionSaving(false);
  };

  const handleAction = async () => {
    if (!actionRow || !actionType || !isAdmin) return;
    setActionSaving(true);

    try {
      if (actionType === "fulfill") {
        await updateDoc(actionRow.ref, {
          status: "fulfilled",
          adminUid: user?.uid,
          decidedAt: serverTimestamp(),
        });

        setCashouts((prev) =>
          prev.map((r) => (r.id === actionRow.id ? { ...r, status: "fulfilled" } : r))
        );
      }

      if (actionType === "deny") {
        if (!denialReason.trim()) {
          alert("Enter denial reason");
          setActionSaving(false);
          return;
        }

        if (refundOnDeny) {
          const userRef = doc(db, "users", actionRow.userId);
          const uSnap = await getDoc(userRef);
          if (uSnap.exists()) {
            const bal = Number(uSnap.data().balance || 0);
            await updateDoc(userRef, { balance: bal + actionRow.amount });
          }
        }

        await updateDoc(actionRow.ref, {
          status: "denied",
          adminUid: user?.uid,
          decidedAt: serverTimestamp(),
          denialReason: denialReason.trim(),
          refunded: refundOnDeny,
        });

        setCashouts((prev) =>
          prev.map((r) =>
            r.id === actionRow.id
              ? {
                  ...r,
                  status: "denied",
                  denialReason: denialReason.trim(),
                  refunded: refundOnDeny,
                }
              : r
          )
        );
      }
    } catch (err) {
      console.error(err);
      alert("Failed to process action.");
    } finally {
      setActionSaving(false);
      closeModal();
    }
  };

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  if (!isAdmin) {
    return (
      <main className="rb-content">
        <div className="dash-card modern-card glassy-card admin-denied">
          <h2>Admin Only</h2>
          <p className="dash-muted">You do not have permission to view this page.</p>
        </div>
      </main>
    );
  }

    const formatDate = (ts: any) => {
      if (!ts) return "--";
      if (ts.toDate) return ts.toDate().toLocaleString();
      if (ts instanceof Date) return ts.toLocaleString();
      return "--";
    };


  const suspicionClass = (row: CashoutRow) => {
    const s = row.suspiciousScore || 0;
    if (s <= 0) return "suspicion-normal";
    if (s === 1) return "suspicion-low";
    if (s === 2) return "suspicion-medium";
    return "suspicion-high";
  };

  const suspicionLabel = (row: CashoutRow) => {
    const s = row.suspiciousScore || 0;
    if (s <= 0) return "Normal";
    if (s === 1) return "Watch";
    if (s === 2) return "Moderate";
    return "Suspicious";
  };

  return (
    <main className="rb-content">
      <section className="dash-shell admin-shell">

        {/* HEADER */}
        <div className="admin-header glassy-card neon-glow">
          <h2 className="rb-section-title">Admin · Payouts, Donations & Users</h2>
          <p className="rb-section-sub">
            Review cashouts, donations, analyze accounts, and manage risk.
          </p>
        </div>

        {/* LOOKUP */}
        <div className="glassy-card admin-lookup-card">
          <h3 className="rb-section-title-small">User Lookup by UID</h3>
          <p className="dash-muted">Inspect account + payout history.</p>

          <div className="admin-lookup-row">
            <input
              type="text"
              value={lookupUid}
              onChange={(e) => setLookupUid(e.target.value)}
              placeholder="Enter user UID…"
            />
            <button className="rb-btn" onClick={handleLookup}>Lookup</button>
          </div>

          {lookupLoading && <p className="dash-muted">Loading…</p>}
          {lookupError && <p className="dash-muted error-text">{lookupError}</p>}

          {lookupProfile && (
            <div className="admin-lookup-result">
              <h4>Profile</h4>
              <p><b>UID:</b> {lookupProfile.id}</p>
              <p><b>Username:</b> {lookupProfile.username}</p>
              <p><b>Email:</b> {lookupProfile.email}</p>
              <p><b>Balance:</b> ${Number(lookupProfile.balance).toFixed(2)}</p>
              <p><b>Created:</b> {formatDate(lookupProfile.createdAt)}</p>
            </div>
          )}

          {lookupPayouts.length > 0 && (
            <div className="admin-lookup-payouts">
              <h4>Recent Payouts & Donations</h4>

              {lookupPayouts.map((row) => (
                <div key={row.id} className="dash-card modern-card glassy-card">
                  <p><b>Type:</b> {row.type}</p>
                  <p><b>Amount:</b> ${row.amount.toFixed(2)}</p>
                  <p><b>Method:</b> {row.method}</p>
                  {row.charityName && <p><b>Charity:</b> {row.charityName}</p>}
                  {row.receiptEmail && <p><b>Receipt Email:</b> {row.receiptEmail}</p>}
                  <p><b>Status:</b> {row.status}</p>
                  <p><b>Requested:</b> {formatDate(row.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FILTER TABS */}
        <div className="dash-tabs scrollable-tabs glassy-card">
          {(["pending", "fulfilled", "denied", "all"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              className={`dash-tab-btn ${filterStatus === tab ? "dash-tab-active" : ""}`}
              onClick={() => setFilterStatus(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading && <p className="dash-muted">Loading...</p>}
        {error && <p className="dash-muted error-text">{error}</p>}

        {!loading && !error && (
          <div className="dash-payout-list admin-list scrollable-list">
            {cashouts.length === 0 ? (
              <p className="dash-muted">No requests found.</p>
            ) : (
              cashouts.map((row) => (
                <div key={row.id} className="dash-card modern-card glassy-card admin-card">
                  <p><b>User ID:</b> {row.userId}</p>
                  {row.username && <p><b>Username:</b> {row.username}</p>}
                  {row.userEmail && <p><b>Email:</b> {row.userEmail}</p>}
                  <p><b>Amount:</b> ${row.amount.toFixed(2)}</p>
                  <p><b>Method:</b> {row.method}</p>
                  <p><b>Status:</b> {row.status}</p>
                  <p><b>Requested:</b> {formatDate(row.createdAt)}</p>

                  <p>
                    <b>Risk:</b>{" "}
                    <span className={`suspicion-tag ${suspicionClass(row)}`}>
                      {suspicionLabel(row)}
                    </span>
                  </p>

                  {row.suspiciousReasons && row.suspiciousReasons.length > 0 && (
                    <ul className="suspicion-reasons">
                      {row.suspiciousReasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  )}

                  {row.status === "pending" && (
                    <div className="admin-actions">
                      <button
                        className="rb-btn admin-approve"
                        onClick={() => openModal(row, "fulfill")}
                      >
                        Mark Fulfilled
                      </button>
                      <button
                        className="rb-btn rb-btn-secondary admin-deny"
                        onClick={() => openModal(row, "deny")}
                      >
                        Deny / Refund
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* ACTION MODAL */}
      {actionRow && actionType && (
        <div className="rb-modal">
          <div className="rb-modal-backdrop" onClick={closeModal} />
          <div className="rb-modal-content">
            <h3 className="accent-toast">
              {actionType === "fulfill" ? "Mark as Fulfilled" : "Deny Request"}
            </h3>

            <p>
              <b>Type:</b> {actionRow.type} <br />
              <b>User:</b> {actionRow.userId} <br />
              <b>Amount:</b> ${actionRow.amount.toFixed(2)} via {actionRow.method}
            </p>

            {actionType === "deny" && (
              <>
                <label>Reason for denial:</label>
                <textarea
                  className="admin-denial-text"
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value)}
                />

                <label className="admin-refund-toggle">
                  <input
                    type="checkbox"
                    checked={refundOnDeny}
                    onChange={(e) => setRefundOnDeny(e.target.checked)}
                  />
                  Refund ${actionRow.amount.toFixed(2)} back to user
                </label>
              </>
            )}

            <div className="rb-modal-actions">
              <button
                onClick={handleAction}
                disabled={actionSaving}
                className="hb-btn"
              >
                {actionSaving ? "Saving…" : "Confirm"}
              </button>
              <button className="secondary-btn" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
