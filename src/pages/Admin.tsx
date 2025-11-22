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
import type { User } from "../types";

const ADMIN_UID = "c0WrVU0aaOSM4SGrwhWrSlNjJk72";

type CashoutStatus = "pending" | "fulfilled" | "denied";

interface CashoutRow {
  id: string;
  type: "cashout" | "donation"; // NEW: distinguish source
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

  // Donation-only fields
  charityId?: string | null;
  charityName?: string | null;
  receiptEmail?: string | null;
  readybreadMatch?: number | null;

  // Enriched fields
  userCreatedAt?: any;
  userEmail?: string | null;
  username?: string | null;

  suspiciousScore?: number;
  suspiciousReasons?: string[];
}

interface AdminProps {
  user: User | null;
}

type FilterTab = "pending" | "fulfilled" | "denied" | "all";
type ActionType = "fulfill" | "deny" | null;

export const Admin: React.FC<AdminProps> = ({ user }) => {
  const [cashouts, setCashouts] = useState<CashoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterTab>("pending");

  // User lookup state
  const [lookupUid, setLookupUid] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupProfile, setLookupProfile] = useState<DocumentData | null>(null);
  const [lookupPayouts, setLookupPayouts] = useState<CashoutRow[]>([]);

  // Action modal state
  const [actionRow, setActionRow] = useState<CashoutRow | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [denialReason, setDenialReason] = useState("");
  const [refundOnDeny, setRefundOnDeny] = useState(true);
  const [actionSaving, setActionSaving] = useState(false);

  // Helpers to normalize Firestore docs into our row shape
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
    const charityName =
      typeof data.charityName === "string" && data.charityName.trim()
        ? data.charityName
        : null;

    const readybreadMatch =
      typeof data.readybreadMatch === "number"
        ? data.readybreadMatch
        : Number.isFinite(Number(data.readybreadMatch))
        ? Number(data.readybreadMatch)
        : null;

    return {
      id: docSnap.id,
      type: "donation",
      userId: typeof data.userId === "string" ? data.userId : fallbackUid,
      amount: parseAmount(data.amount),
      method: charityName || "Donation",
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
      charityName,
      receiptEmail:
        typeof data.receiptEmail === "string" ? data.receiptEmail : null,
      readybreadMatch,
    };
  };

  const isAdmin = user?.uid === ADMIN_UID;

  /* -------------------------------------------------------
     LOAD CASHOUT + DONATION REQUESTS (MERGED)
  ------------------------------------------------------- */
  useEffect(() => {
    const loadRequests = async () => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cashoutRef = collection(db, "cashout_requests");
        const donationRef = collection(db, "donation_requests");

        // Fetch everything and filter client-side to avoid index issues and include all statuses
        const fetchAll = (baseRef: any) =>
          getDocs(query(baseRef, orderBy("createdAt", "desc")));

        const [cashoutSnap, donationSnap] = await Promise.all([
          fetchAll(cashoutRef),
          fetchAll(donationRef),
        ]);

        const cashoutRows: CashoutRow[] = cashoutSnap.docs.map((docSnap) =>
          mapCashoutDoc(docSnap)
        );

        const donationRows: CashoutRow[] = donationSnap.docs.map((docSnap) =>
          mapDonationDoc(docSnap)
        );

        // Merge & sort newest first
        let combined = [...cashoutRows, ...donationRows].sort((a, b) => {
          const ta = a.createdAt?.toDate
            ? a.createdAt.toDate().getTime()
            : 0;
          const tb = b.createdAt?.toDate
            ? b.createdAt.toDate().getTime()
            : 0;
          return tb - ta;
        });

        if (filterStatus !== "all") {
          const target = filterStatus.toLowerCase();
          combined = combined.filter((row) => {
            const statusVal = (row.status || "pending").toString().toLowerCase();
            return statusVal === target;
          });
        }

        const enriched = await enrichWithUserDataAndSuspicion(combined);
        setCashouts(enriched);
      } catch (err) {
        console.error("Error loading payout/donation requests:", err);
        setError("Failed to load payout & donation requests.");
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, filterStatus]);

  /* -------------------------------------------------------
     ENRICH ROWS WITH USER DATA & SUSPICION FLAGS
  ------------------------------------------------------- */
  const enrichWithUserDataAndSuspicion = async (
    rows: CashoutRow[]
  ): Promise<CashoutRow[]> => {
    if (!rows.length) return rows;

    const uidSet = new Set<string>();
    rows.forEach((r) => {
      if (r.userId) uidSet.add(r.userId);
    });

    const uidArray = Array.from(uidSet);
    const userMap: Record<string, any> = {};

    await Promise.all(
      uidArray.map(async (uid) => {
        try {
          const userRef = doc(db, "users", uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            userMap[uid] = userSnap.data();
          }
        } catch (e) {
          console.warn("Failed to load user profile for", uid, e);
        }
      })
    );

    const now = Date.now();

    return rows.map((row) => {
      const u = userMap[row.userId];
      const reasons: string[] = [];
      let score = 0;

      if (!u) {
        reasons.push("No user profile found.");
        score += 2;
      } else {
        const createdAt = u.createdAt;
        let accountAgeHours: number | null = null;

        if (createdAt && createdAt.toDate) {
          accountAgeHours =
            (now - createdAt.toDate().getTime()) / (1000 * 60 * 60);
        }

        if (accountAgeHours !== null && accountAgeHours < 24) {
          reasons.push("Account is less than 24 hours old.");
          score += 2;
        }

        if (!u.username || !u.email) {
          reasons.push("Missing username or email on profile.");
          score += 1;
        }
      }

      if (row.amount >= 15) {
        reasons.push("High payout/donation amount.");
        score += 1;
      }

      if (row.status === "denied") {
        reasons.push("Previously denied request.");
        score += 1;
      }

      return {
        ...row,
        userCreatedAt: u?.createdAt,
        userEmail: u?.email || null,
        username: u?.username || null,
        suspiciousScore: score,
        suspiciousReasons: reasons,
      };
    });
  };

  /* -------------------------------------------------------
     HELPERS
  ------------------------------------------------------- */
  const formatDateTime = (ts: any) => {
    if (ts?.toDate) {
      return ts.toDate().toLocaleString();
    }
    return "--";
  };

  const suspicionLabel = (row: CashoutRow) => {
    const score = row.suspiciousScore || 0;
    if (score <= 0) return "Normal";
    if (score === 1) return "Watch";
    if (score === 2) return "Moderate";
    return "Suspicious";
  };

  const suspicionClass = (row: CashoutRow) => {
    const score = row.suspiciousScore || 0;
    if (score <= 0) return "suspicion-normal";
    if (score === 1) return "suspicion-low";
    if (score === 2) return "suspicion-medium";
    return "suspicion-high";
  };

  /* -------------------------------------------------------
     USER LOOKUP BY UID (CASHOUT + DONATION)
  ------------------------------------------------------- */
  const handleLookup = async () => {
    const uid = lookupUid.trim();
    if (!uid) {
      setLookupError("Enter a UID to search.");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupProfile(null);
    setLookupPayouts([]);

    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setLookupError("No user profile found for that UID.");
        setLookupLoading(false);
        return;
      }

      setLookupProfile({ id: userSnap.id, ...userSnap.data() });

      // Load recent cashouts
      const cashoutRef = collection(db, "cashout_requests");
      const qCash = query(
        cashoutRef,
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const cashSnap = await getDocs(qCash);

      const cashRows: CashoutRow[] = cashSnap.docs.map((docSnap) =>
        mapCashoutDoc(docSnap, uid)
      );

      // Load recent donations
      const donationRef = collection(db, "donation_requests");
      const qDon = query(
        donationRef,
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const donSnap = await getDocs(qDon);

      const donationRows: CashoutRow[] = donSnap.docs.map((docSnap) =>
        mapDonationDoc(docSnap, uid)
      );

      const combined = [...cashRows, ...donationRows].sort((a, b) => {
        const ta = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : 0;
        const tb = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : 0;
        return tb - ta;
      });

      setLookupPayouts(combined);
    } catch (err) {
      console.error("Lookup error:", err);
      setLookupError("Error loading user details. Check console.");
    } finally {
      setLookupLoading(false);
    }
  };

  /* -------------------------------------------------------
     ADMIN ACTIONS: FULFILL / DENY / REFUND
     (Works for BOTH cashout + donation)
  ------------------------------------------------------- */
  const openActionModal = (row: CashoutRow, type: ActionType) => {
    setActionRow(row);
    setActionType(type);
    setDenialReason("");
    setRefundOnDeny(true);
  };

  const closeActionModal = () => {
    setActionRow(null);
    setActionType(null);
    setDenialReason("");
    setRefundOnDeny(true);
    setActionSaving(false);
  };

  const handleConfirmAction = async () => {
    if (!actionRow || !actionType || !isAdmin) return;

    setActionSaving(true);
    try {
      if (actionType === "fulfill") {
        await updateDoc(actionRow.ref, {
          status: "fulfilled",
          decidedAt: serverTimestamp(),
          adminUid: user?.uid || null,
        });

        setCashouts((prev) =>
          prev.map((r) =>
            r.id === actionRow.id ? { ...r, status: "fulfilled" } : r
          )
        );
      } else if (actionType === "deny") {
        if (!denialReason.trim()) {
          alert("Please enter a reason for denial.");
          setActionSaving(false);
          return;
        }

        // Optionally refund user balance (works for both types)
        if (refundOnDeny) {
          const userRef = doc(db, "users", actionRow.userId);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data() || {};
            const oldBalance = Number(data.balance || 0);
            const newBalance = oldBalance + actionRow.amount;
            await updateDoc(userRef, { balance: newBalance });
          }
        }

        await updateDoc(actionRow.ref, {
          status: "denied",
          decidedAt: serverTimestamp(),
          adminUid: user?.uid || null,
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
      console.error("Admin action error:", err);
      alert("Failed to apply action. Check console for details.");
    } finally {
      setActionSaving(false);
      closeActionModal();
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
          <p className="dash-muted">
            You do not have permission to view this page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="rb-content">
      <section className="dash-shell admin-shell">
        {/* Admin Header */}
        <div className="admin-header glassy-card neon-glow">
          <h2 className="rb-section-title">Admin · Payouts, Donations & Users</h2>
          <p className="rb-section-sub">
            Review cashouts, donations, analyze accounts, and manage risk.
          </p>
        </div>

        {/* USER LOOKUP PANEL */}
        <div className="glassy-card admin-lookup-card">
          <h3 className="rb-section-title-small">User Lookup by UID</h3>
          <p className="dash-muted">
            Paste a Firebase UID to inspect an account and recent payout /
            donation history.
          </p>
          <div className="admin-lookup-row">
            <input
              type="text"
              value={lookupUid}
              onChange={(e) => setLookupUid(e.target.value)}
              placeholder="Enter user UID…"
            />
            <button className="rb-btn" onClick={handleLookup}>
              Lookup
            </button>
          </div>
          {lookupLoading && <p className="dash-muted">Loading user…</p>}
          {lookupError && (
            <p className="dash-muted error-text">{lookupError}</p>
          )}

          {lookupProfile && (
            <div className="admin-lookup-result">
              <h4>Profile</h4>
              <p>
                <span className="dash-label">UID:</span>{" "}
                <code>{lookupProfile.id}</code>
              </p>
              <p>
                <span className="dash-label">Username:</span>{" "}
                {lookupProfile.username || "—"}
              </p>
              <p>
                <span className="dash-label">Email:</span>{" "}
                {lookupProfile.email || "—"}
              </p>
              <p>
                <span className="dash-label">Balance:</span>{" "}
                ${Number(lookupProfile.balance || 0).toFixed(2)}
              </p>
              <p>
                <span className="dash-label">Created:</span>{" "}
                {lookupProfile.createdAt?.toDate
                  ? lookupProfile.createdAt.toDate().toLocaleString()
                  : "—"}
              </p>
            </div>
          )}

          {lookupPayouts.length > 0 && (
            <div className="admin-lookup-payouts">
              <h4>Recent Payouts & Donations</h4>
              {lookupPayouts.map((row) => (
                <div
                  key={row.id}
                  className="dash-card modern-card glassy-card"
                >
                  <p className="dash-line">
                    <span className="dash-label">Type:</span>{" "}
                    {row.type === "donation" ? "Donation" : "Cashout"}
                  </p>
                  <p className="dash-line">
                    <span className="dash-label">Amount:</span>{" "}
                    ${row.amount.toFixed(2)}
                  </p>
                  <p className="dash-line">
                    <span className="dash-label">Method:</span> {row.method}
                  </p>
                  {row.type === "donation" && row.charityName && (
                    <p className="dash-line">
                      <span className="dash-label">Charity:</span>{" "}
                      {row.charityName}
                    </p>
                  )}
                  {row.type === "donation" && row.receiptEmail && (
                    <p className="dash-line">
                      <span className="dash-label">Receipt Email:</span>{" "}
                      {row.receiptEmail}
                    </p>
                  )}
                  <p className="dash-line">
                    <span className="dash-label">Status:</span>{" "}
                    <span className={`status-tag status-${row.status}`}>
                      {row.status}
                    </span>
                  </p>
                  <p className="dash-line">
                    <span className="dash-label">Requested:</span>{" "}
                    {formatDateTime(row.createdAt)}
                  </p>
                  {row.denialReason && (
                    <p className="dash-line">
                      <span className="dash-label">Denial reason:</span>{" "}
                      {row.denialReason}
                    </p>
                  )}
                  {row.refunded && (
                    <p className="dash-line">
                      <span className="dash-label">Refunded:</span> Yes
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FILTER TABS */}
        <div className="dash-tabs scrollable-tabs glassy-card">
          <button
            className={`dash-tab-btn ${
              filterStatus === "pending" ? "dash-tab-active" : ""
            }`}
            onClick={() => setFilterStatus("pending")}
          >
            Pending
          </button>
          <button
            className={`dash-tab-btn ${
              filterStatus === "fulfilled" ? "dash-tab-active" : ""
            }`}
            onClick={() => setFilterStatus("fulfilled")}
          >
            Fulfilled
          </button>
          <button
            className={`dash-tab-btn ${
              filterStatus === "denied" ? "dash-tab-active" : ""
            }`}
            onClick={() => setFilterStatus("denied")}
          >
            Denied
          </button>
          <button
            className={`dash-tab-btn ${
              filterStatus === "all" ? "dash-tab-active" : ""
            }`}
            onClick={() => setFilterStatus("all")}
          >
            All
          </button>
        </div>

        {loading && <p className="dash-muted">Loading requests…</p>}
        {error && <p className="dash-muted error-text">{error}</p>}

        {!loading && !error && cashouts.length === 0 && (
          <p className="dash-muted">No payout or donation requests found.</p>
        )}

        {!loading && !error && cashouts.length > 0 && (
          <div className="dash-payout-list admin-list scrollable-list">
            {cashouts.map((row) => (
              <div
                key={row.id}
                className="dash-card modern-card glassy-card admin-card"
              >
                <p className="dash-line">
                  <span className="dash-label">Type:</span>{" "}
                  {row.type === "donation" ? "Donation" : "Cashout"}
                </p>
                <p className="dash-line">
                  <span className="dash-label">User ID:</span> {row.userId}
                </p>
                {row.username && (
                  <p className="dash-line">
                    <span className="dash-label">Username:</span>{" "}
                    {row.username}
                  </p>
                )}
                {row.userEmail && (
                  <p className="dash-line">
                    <span className="dash-label">Email:</span> {row.userEmail}
                  </p>
                )}
                <p className="dash-line">
                  <span className="dash-label">Amount:</span>{" "}
                  ${row.amount.toFixed(2)}
                </p>
                <p className="dash-line">
                  <span className="dash-label">Method:</span> {row.method}
                </p>
                {row.type === "donation" && row.charityName && (
                  <p className="dash-line">
                    <span className="dash-label">Charity:</span>{" "}
                    {row.charityName}
                  </p>
                )}
                {row.type === "donation" && row.readybreadMatch != null && (
                  <p className="dash-line">
                    <span className="dash-label">ReadyBread Match:</span>{" "}
                    {row.readybreadMatch.toFixed(2)}x
                  </p>
                )}
                {row.type === "donation" && row.receiptEmail && (
                  <p className="dash-line">
                    <span className="dash-label">Receipt Email:</span>{" "}
                    {row.receiptEmail}
                  </p>
                )}
                {row.paypalEmail && (
                  <p className="dash-line">
                    <span className="dash-label">PayPal:</span>{" "}
                    {row.paypalEmail}
                  </p>
                )}
                {row.cashappTag && (
                  <p className="dash-line">
                    <span className="dash-label">Cash App:</span>{" "}
                    {row.cashappTag}
                  </p>
                )}
                <p className="dash-line">
                  <span className="dash-label">Status:</span>{" "}
                  <span className={`status-tag status-${row.status}`}>
                    {row.status}
                  </span>
                </p>
                <p className="dash-line">
                  <span className="dash-label">Requested:</span>{" "}
                  {formatDateTime(row.createdAt)}
                </p>
                <p className="dash-line">
                  <span className="dash-label">Risk:</span>{" "}
                  <span className={`suspicion-tag ${suspicionClass(row)}`}>
                    {suspicionLabel(row)}
                  </span>
                </p>
                {row.suspiciousReasons &&
                  row.suspiciousReasons.length > 0 && (
                    <ul className="suspicion-reasons">
                      {row.suspiciousReasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  )}
                {row.denialReason && (
                  <p className="dash-line">
                    <span className="dash-label">Denial reason:</span>{" "}
                    {row.denialReason}
                  </p>
                )}
                {row.refunded && (
                  <p className="dash-line">
                    <span className="dash-label">Refunded:</span> Yes
                  </p>
                )}

                {row.status === "pending" && (
                  <div className="admin-actions">
                    <button
                      className="rb-btn admin-approve"
                      onClick={() => openActionModal(row, "fulfill")}
                    >
                      Mark Fulfilled
                    </button>
                    <button
                      className="rb-btn rb-btn-secondary admin-deny"
                      onClick={() => openActionModal(row, "deny")}
                    >
                      Deny / Refund
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ACTION MODAL */}
      {actionRow && actionType && (
        <div className="rb-modal">
          <div className="rb-modal-backdrop" onClick={closeActionModal} />
          <div className="rb-modal-content">
            <h3 className="accent-toast">
              {actionType === "fulfill"
                ? "Mark request as fulfilled"
                : "Deny request"}
            </h3>

            <p className="soft-text">
              <b>Type:</b> {actionRow.type === "donation" ? "Donation" : "Cashout"}
              <br />
              <b>UID:</b> {actionRow.userId}
              <br />
              <b>Amount:</b> ${actionRow.amount.toFixed(2)} via{" "}
              {actionRow.method}
            </p>

            {actionType === "deny" && (
              <>
                <label className="modal-label">
                  Reason for denial (visible to user)
                </label>
                <textarea
                  className="admin-denial-text"
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value)}
                  placeholder="Example: Activity appears fraudulent, please contact support."
                />

                <label className="admin-refund-toggle">
                  <input
                    type="checkbox"
                    checked={refundOnDeny}
                    onChange={(e) => setRefundOnDeny(e.target.checked)}
                  />
                  Refund ${actionRow.amount.toFixed(2)} back to user balance
                </label>
              </>
            )}

            <div className="rb-modal-actions">
              <button
                className="hb-btn"
                onClick={handleConfirmAction}
                disabled={actionSaving}
              >
                {actionSaving ? "Saving…" : "Confirm"}
              </button>
              <button
                className="secondary-btn"
                onClick={closeActionModal}
                disabled={actionSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
