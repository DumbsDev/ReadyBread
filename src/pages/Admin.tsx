// src/pages/Admin.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../config/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { useUser } from "../contexts/UserContext";

type CashoutStatus = "pending" | "fulfilled" | "denied";
type FilterTab = "pending" | "fulfilled" | "denied" | "all";
type ActionType = "fulfill" | "deny" | null;

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
  bitcoinAddress?: string | null;
  litecoinAddress?: string | null;
  dogecoinAddress?: string | null;
  cryptoFee?: number | null;
  denialReason?: string | null;
  refunded?: boolean;
  ref?: QueryDocumentSnapshot["ref"];
  charityName?: string | null;
  receiptEmail?: string | null;
  userEmail?: string | null;
  username?: string | null;
  suspiciousScore?: number;
  suspiciousReasons?: string[];
  deviceId?: string | null;
  ipHash?: string | null;
  deviceUserCount?: number | null;
  ipUserCount?: number | null;
}

interface UserEventRow {
  id: string;
  type?: string | null;
  amount?: number | null;
  source?: string | null;
  createdAt?: any;
}

interface PartnerStat {
  source: string;
  total: number;
  count: number;
}

interface FingerprintRow {
  id?: string;
  deviceId?: string | null;
  ip?: string | null;
  ipHash?: string | null;
  lastSeen?: any;
  userAgent?: string | null;
  deviceUserCount?: number | null;
  ipUserCount?: number | null;
}

interface FraudLogRow {
  id: string;
  type: string;
  source?: string | null;
  txId?: string | null;
  reasons?: string[];
  counts?: Record<string, number>;
  createdAt?: any;
}

export const Admin: React.FC = () => {
  const { user, admin } = useUser();

  const [activeTab, setActiveTab] = useState<"analytics" | "payouts" | "users" | "partners">(
    "analytics"
  );

  const [cashouts, setCashouts] = useState<CashoutRow[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterTab>("pending");

  const [lookupUid, setLookupUid] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupProfile, setLookupProfile] = useState<DocumentData | null>(null);
  const [lookupPayouts, setLookupPayouts] = useState<CashoutRow[]>([]);
  const [lookupEvents, setLookupEvents] = useState<UserEventRow[]>([]);
  const [banReason, setBanReason] = useState("");
  const [banDeviceId, setBanDeviceId] = useState("");
  const [banIp, setBanIp] = useState("");

  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerStats, setPartnerStats] = useState<PartnerStat[]>([]);

  const [fingerprints, setFingerprints] = useState<FingerprintRow[]>([]);
  const [deviceInsight, setDeviceInsight] = useState<FingerprintRow | null>(null);
  const [fraudLogs, setFraudLogs] = useState<FraudLogRow[]>([]);

  const [actionRow, setActionRow] = useState<CashoutRow | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [denialReason, setDenialReason] = useState("");
  const [refundOnDeny, setRefundOnDeny] = useState(true);
  const [actionSaving, setActionSaving] = useState(false);

  // Helpers
  const formatDate = (ts: any) => {
    if (!ts) return "--";
    if (ts.toDate) return ts.toDate().toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    return "--";
  };

  const formatShortDate = (ts: any) => {
    if (!ts) return "--";
    if (ts.toDate) return ts.toDate().toLocaleDateString();
    if (ts instanceof Date) return ts.toLocaleDateString();
    return "--";
  };

  const formatCurrency = (n?: number | null) => `$${(Number(n) || 0).toFixed(2)}`;

  const parseAmount = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const mapCashoutDoc = (
    docSnap: QueryDocumentSnapshot<DocumentData>,
    fallbackUid = "unknown"
  ): CashoutRow => {
    const data = (docSnap.data() || {}) as Record<string, any>;
    const cryptoFee = parseAmount(data.cryptoFee);
    return {
      id: docSnap.id,
      type: "cashout",
      userId: typeof data.userId === "string" ? data.userId : fallbackUid,
      amount: parseAmount(data.amount),
      method: typeof data.method === "string" ? data.method : "unknown",
      status: typeof data.status === "string" ? (data.status as CashoutStatus) : "pending",
      createdAt: data.createdAt,
      paypalEmail: typeof data.paypalEmail === "string" ? data.paypalEmail : null,
      cashappTag: typeof data.cashappTag === "string" ? data.cashappTag : null,
      bitcoinAddress: typeof data.bitcoinAddress === "string" ? data.bitcoinAddress : null,
      litecoinAddress: typeof data.litecoinAddress === "string" ? data.litecoinAddress : null,
      dogecoinAddress: typeof data.dogecoinAddress === "string" ? data.dogecoinAddress : null,
      cryptoFee: Number.isFinite(cryptoFee) && cryptoFee > 0 ? cryptoFee : null,
      denialReason: typeof data.denialReason === "string" ? data.denialReason : null,
      refunded: Boolean(data.refunded),
      ref: docSnap.ref,
    };
  };

  const mapDonationDoc = (
    docSnap: QueryDocumentSnapshot<DocumentData>,
    fallbackUid = "unknown"
  ): CashoutRow => {
    const data = (docSnap.data() || {}) as Record<string, any>;
    return {
      id: docSnap.id,
      type: "donation",
      userId: typeof data.userId === "string" ? data.userId : fallbackUid,
      amount: parseAmount(data.amount),
      method: data.charityName || "Donation",
      status: typeof data.status === "string" ? (data.status as CashoutStatus) : "pending",
      createdAt: data.createdAt,
      denialReason: typeof data.denialReason === "string" ? data.denialReason : null,
      refunded: Boolean(data.refunded),
      ref: docSnap.ref,
      charityName: typeof data.charityName === "string" ? data.charityName : null,
      receiptEmail: typeof data.receiptEmail === "string" ? data.receiptEmail : null,
    };
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

  // Load payout/donation requests
  useEffect(() => {
    const load = async () => {
      if (!admin) {
        setLoadingPayouts(false);
        return;
      }
      setLoadingPayouts(true);
      setPayoutError(null);
      try {
        const cashRef = collection(db, "cashout_requests");
        const donRef = collection(db, "donation_requests");
        const fetchAll = (r: any) => getDocs(query(r, orderBy("createdAt", "desc")));
        const [cashSnap, donSnap] = await Promise.all([fetchAll(cashRef), fetchAll(donRef)]);
        const cashRows = cashSnap.docs.map((d) => mapCashoutDoc(d as any));
        const donRows = donSnap.docs.map((d) => mapDonationDoc(d as any));
        let combined = [...cashRows, ...donRows].sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });
        if (filterStatus !== "all") {
          combined = combined.filter((r) => r.status.toString().toLowerCase() === filterStatus);
        }
        const enriched = await enrichRows(combined);
        setCashouts(enriched);
      } catch (err) {
        console.error(err);
        setPayoutError("Failed to load requests.");
      } finally {
        setLoadingPayouts(false);
      }
    };
    load();
  }, [admin, filterStatus]);

  const enrichRows = async (rows: CashoutRow[]) => {
    const uidSet = new Set(rows.map((r) => r.userId));
    const uidArr = Array.from(uidSet);
    const userData: Record<string, any> = {};
    await Promise.all(
      uidArr.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) userData[uid] = snap.data();
        } catch {
          /* ignore */
        }
      })
    );

    const deviceIds = new Set<string>();
    const ipHashes = new Set<string>();
    rows.forEach((r) => {
      const u = userData[r.userId];
      const devId =
        (typeof u?.lastDeviceId === "string" && u.lastDeviceId) ||
        (typeof u?.deviceId === "string" && u.deviceId) ||
        null;
      const ipHash =
        (typeof u?.lastIpHash === "string" && u.lastIpHash) || null;
      if (devId) deviceIds.add(devId);
      if (ipHash) ipHashes.add(ipHash);
    });

    const deviceCounts: Record<string, any> = {};
    await Promise.all(
      Array.from(deviceIds).map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "deviceFingerprints", id));
          if (snap.exists()) deviceCounts[id] = snap.data();
        } catch {
          /* ignore */
        }
      })
    );

    const ipCounts: Record<string, any> = {};
    await Promise.all(
      Array.from(ipHashes).map(async (hash) => {
        try {
          const snap = await getDoc(doc(db, "ipClusters", hash));
          if (snap.exists()) ipCounts[hash] = snap.data();
        } catch {
          /* ignore */
        }
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
      const deviceId =
        (typeof u?.lastDeviceId === "string" && u.lastDeviceId) ||
        (typeof u?.deviceId === "string" && u.deviceId) ||
        null;
      const ipHash =
        (typeof u?.lastIpHash === "string" && u.lastIpHash) || null;
      const deviceUserCount = deviceId ? deviceCounts[deviceId]?.count || null : null;
      const ipUserCount = ipHash ? ipCounts[ipHash]?.count || null : null;

      if (deviceUserCount && deviceUserCount > 1) {
        reasons.push(`Device seen on ${deviceUserCount} users`);
        score += 1;
      }
      if (ipUserCount && ipUserCount > 2) {
        reasons.push(`IP cluster has ${ipUserCount} users`);
        score += 1;
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
        userEmail: u?.email || null,
        username: u?.username || null,
        deviceId,
        ipHash,
        deviceUserCount,
        ipUserCount,
        suspiciousScore: score,
        suspiciousReasons: reasons,
      };
    });
  };

  const payoutSummary = useMemo(() => {
    let pending = 0;
    let fulfilled = 0;
    let denied = 0;
    let totalAmount = 0;
    cashouts.forEach((r) => {
      const status = (r.status || "").toString().toLowerCase();
      if (status === "pending") pending += 1;
      if (status === "fulfilled") fulfilled += 1;
      if (status === "denied") denied += 1;
      totalAmount += Number(r.amount) || 0;
    });
    return { pending, fulfilled, denied, total: cashouts.length, totalAmount };
  }, [cashouts]);

  const analyticsTotals = useMemo(() => {
    const totalCash = cashouts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const pendingCash = cashouts
      .filter((c) => (c.status || "").toString().toLowerCase() === "pending")
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    return { requests: cashouts.length, totalCash, pendingCash };
  }, [cashouts]);

  const loadUserInsights = async (uid: string, profileData: any) => {
    setFingerprints([]);
    setDeviceInsight(null);
    setFraudLogs([]);

    try {
      const fpSnap = await getDocs(
        query(
          collection(db, "users", uid, "fingerprints"),
          orderBy("lastSeen", "desc"),
          limit(5)
        )
      );
      setFingerprints(
        fpSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            deviceId: data.deviceId || d.id,
            ip: data.ip || null,
            ipHash: data.ipHash || null,
            lastSeen: data.lastSeen || data.createdAt,
            userAgent: data.userAgent || null,
          };
        })
      );
    } catch {
      setFingerprints([]);
    }

    const baseDeviceId =
      (typeof profileData?.deviceId === "string" && profileData.deviceId) ||
      (typeof profileData?.lastDeviceId === "string" && profileData.lastDeviceId) ||
      null;
    const lastIpHash =
      (typeof profileData?.lastIpHash === "string" && profileData.lastIpHash) || null;

    if (baseDeviceId) {
      try {
        const snap = await getDoc(doc(db, "deviceFingerprints", baseDeviceId));
        if (snap.exists()) {
          const data = snap.data() as any;
          setDeviceInsight((prev) => ({
            ...(prev || {}),
            deviceId: baseDeviceId,
            deviceUserCount: data.count || null,
            ipUserCount: data.ipUserCount || data.ipCount || null,
            ip: data.lastIp || null,
            ipHash: data.lastIpHash || null,
            lastSeen: data.lastSeen || data.createdAt,
          }));
        }
      } catch {
        /* ignore */
      }
    }

    if (lastIpHash) {
      try {
        const snap = await getDoc(doc(db, "ipClusters", lastIpHash));
        if (snap.exists()) {
          const data = snap.data() as any;
          setDeviceInsight((prev) => ({
            ...(prev || {}),
            ipUserCount: data.count || prev?.ipUserCount || null,
            ip: prev?.ip || data.lastIp || null,
            ipHash: lastIpHash,
            lastSeen: prev?.lastSeen || data.lastSeen || data.createdAt,
          }));
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const fraudSnap = await getDocs(
        query(collection(db, "fraudLogs"), where("uid", "==", uid), limit(20))
      );
      setFraudLogs(
        fraudSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    } catch {
      setFraudLogs([]);
    }
  };

  // Lookup
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
    setLookupEvents([]);
    setFingerprints([]);
    setDeviceInsight(null);
    setFraudLogs([]);
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setLookupError("User not found");
        setLookupLoading(false);
        return;
      }
      const profileData = snap.data();
      setLookupProfile({ id: uid, ...profileData });
      await loadUserInsights(uid, profileData);
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
      const rows: CashoutRow[] = [
        ...cashSnap.docs.map((d) => mapCashoutDoc(d as any, uid)),
        ...donSnap.docs.map((d) => mapDonationDoc(d as any, uid)),
      ].sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      setLookupPayouts(rows);
      const eventsSnap = await getDocs(
        query(collection(db, "users", uid, "offers"), orderBy("createdAt", "desc"), limit(25))
      );
      setLookupEvents(
        eventsSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            type: (data.type as string) || null,
            source: (data.source as string) || null,
            amount: typeof data.amount === "number" ? data.amount : null,
            createdAt: data.createdAt,
          };
        })
      );
    } catch (err) {
      console.error(err);
      setLookupError("Error loading user data");
    } finally {
      setLookupLoading(false);
    }
  };

  // Actions
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

  const syncUserPayout = async (
    userId: string,
    payoutId: string,
    data: Partial<{ status: CashoutStatus; notes: string | null; refunded: boolean; decidedAt: any }>
  ) => {
    const payoutRef = doc(db, "users", userId, "payouts", payoutId);
    await setDoc(
      payoutRef,
      {
        ...data,
        decidedAt: data.decidedAt ?? serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleAction = async () => {
    if (!actionRow || !actionType || !admin) return;
    setActionSaving(true);
    try {
      if (actionType === "fulfill") {
        await updateDoc(actionRow.ref!, {
          status: "fulfilled",
          adminUid: user?.uid,
          decidedAt: serverTimestamp(),
        });
        await syncUserPayout(actionRow.userId, actionRow.id, { status: "fulfilled", notes: "Fulfilled" });
        setCashouts((prev) => prev.map((r) => (r.id === actionRow.id ? { ...r, status: "fulfilled" } : r)));
      }
      if (actionType === "deny") {
        if (!denialReason.trim()) {
          alert("Enter denial reason");
          setActionSaving(false);
          return;
        }
        const refundAmount = actionRow.amount + (actionRow.cryptoFee || 0);
        if (refundOnDeny) {
          const userRef = doc(db, "users", actionRow.userId);
          const uSnap = await getDoc(userRef);
          if (uSnap.exists()) {
            const bal = Number((uSnap.data() as any).balance || 0);
            await updateDoc(userRef, { balance: bal + refundAmount });
          }
        }
        await updateDoc(actionRow.ref!, {
          status: "denied",
          adminUid: user?.uid,
          decidedAt: serverTimestamp(),
          denialReason: denialReason.trim(),
          refunded: refundOnDeny,
        });
        await syncUserPayout(actionRow.userId, actionRow.id, {
          status: "denied",
          notes: denialReason.trim(),
          refunded: refundOnDeny,
        });
        setCashouts((prev) =>
          prev.map((r) =>
            r.id === actionRow.id
              ? { ...r, status: "denied", denialReason: denialReason.trim(), refunded: refundOnDeny }
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

  // Ban controls
  const handleBanUser = async () => {
    if (!lookupProfile?.id) return;
    const reason = banReason.trim() || "Manual ban";
    try {
      await updateDoc(doc(db, "users", lookupProfile.id), {
        isBanned: true,
        banReason: reason,
        bannedAt: serverTimestamp(),
        bannedBy: user?.uid || null,
      });
      alert("User banned.");
    } catch (err) {
      console.error(err);
      alert("Failed to ban user.");
    }
  };

  const handleBanDevice = async () => {
    const device = banDeviceId.trim();
    if (!device) {
      alert("Enter a device ID");
      return;
    }
    const reason = banReason.trim() || "Manual ban";
    try {
      await setDoc(
        doc(db, "bannedDevices", device),
        {
          reason,
          createdAt: serverTimestamp(),
          bannedBy: user?.uid || null,
          userId: lookupProfile?.id || null,
        },
        { merge: true }
      );
      alert("Device banned.");
    } catch (err) {
      console.error(err);
      alert("Failed to ban device.");
    }
  };

  const handleBanIp = async () => {
    const ip = banIp.trim();
    if (!ip) {
      alert("Enter an IP");
      return;
    }
    const reason = banReason.trim() || "Manual ban";
    try {
      await setDoc(
        doc(db, "bannedIps", ip),
        {
          reason,
          createdAt: serverTimestamp(),
          bannedBy: user?.uid || null,
          userId: lookupProfile?.id || null,
        },
        { merge: true }
      );
      alert("IP banned.");
    } catch (err) {
      console.error(err);
      alert("Failed to ban IP.");
    }
  };

  // Partner stats
  useEffect(() => {
    const loadPartnerStats = async () => {
      if (!admin) return;
      setPartnerLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, "completedOffers"), orderBy("creditedAt", "desc"), limit(200))
        );
        const totals: Record<string, { total: number; count: number }> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const src = (data.source || data.type || "unknown").toString();
          const amt = Number(data.payout || data.amount || 0) || 0;
          if (!totals[src]) totals[src] = { total: 0, count: 0 };
          totals[src].total += amt;
          totals[src].count += 1;
        });
        const arr: PartnerStat[] = Object.entries(totals)
          .map(([source, v]) => ({ source, total: v.total, count: v.count }))
          .sort((a, b) => b.total - a.total);
        setPartnerStats(arr);
      } catch (err) {
        console.error(err);
        setPartnerStats([]);
      } finally {
        setPartnerLoading(false);
      }
    };
    loadPartnerStats();
  }, [admin]);

  if (!admin) {
    return (
      <main className="rb-content">
        <div className="dash-card modern-card glassy-card admin-denied">
          <h2>Admin Only</h2>
          <p className="dash-muted">You do not have permission to view this page.</p>
        </div>
      </main>
    );
  }

  const renderAnalytics = () => (
    <div className="admin-analytics">
      <div className="admin-summary-grid">
        <div className="glassy-card admin-summary-card">
          <p className="dash-label">Total requests</p>
          <h3>{payoutSummary.total}</h3>
          <p className="dash-muted">{formatCurrency(payoutSummary.totalAmount)}</p>
        </div>
        <div className="glassy-card admin-summary-card">
          <p className="dash-label">Pending</p>
          <h3>{payoutSummary.pending}</h3>
          <p className="dash-muted">{formatCurrency(analyticsTotals.pendingCash)}</p>
        </div>
        <div className="glassy-card admin-summary-card">
          <p className="dash-label">Fulfilled</p>
          <h3>{payoutSummary.fulfilled}</h3>
        </div>
        <div className="glassy-card admin-summary-card">
          <p className="dash-label">Denied</p>
          <h3>{payoutSummary.denied}</h3>
        </div>
      </div>

      <div className="glassy-card admin-lookup-card">
        <h3 className="rb-section-title-small">Recent activity</h3>
        <p className="dash-muted">Snapshot of the latest payout requests.</p>
        <div className="admin-activity-list">
          {cashouts.slice(0, 8).map((c) => (
            <div key={c.id} className="admin-activity-row">
              <div>
                <p className="dash-label">{c.type}</p>
                <p className="dash-muted">{formatDate(c.createdAt)}</p>
              </div>
              <div className="admin-activity-amount">{formatCurrency(c.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPayouts = () => (
    <div className="admin-grid">
      <div className="admin-column">
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

        {loadingPayouts && <p className="dash-muted">Loading...</p>}
        {payoutError && <p className="dash-muted error-text">{payoutError}</p>}

        {!loadingPayouts && !payoutError && (
          <div className="dash-payout-list admin-list scrollable-list">
            {cashouts.length === 0 ? (
              <p className="dash-muted">No requests found.</p>
            ) : (
              cashouts.map((row) => {
                const statusClass = row.status ? row.status.toString().toLowerCase() : "pending";
                return (
                  <div key={row.id} className={`dash-card modern-card glassy-card admin-card status-${statusClass}`}>
                    <p>
                      <b>User ID:</b> {row.userId}
                    </p>
                    {row.username && (
                      <p>
                        <b>Username:</b> {row.username}
                      </p>
                    )}
                    {row.userEmail && (
                      <p>
                        <b>Email:</b> {row.userEmail}
                      </p>
                    )}
                    <p>
                      <b>Amount:</b> {formatCurrency(row.amount)}
                    </p>
                    <p>
                      <b>Method:</b> {row.method}
                    </p>
                    {row.cryptoFee ? (
                      <p>
                        <b>Crypto fee:</b> ${row.cryptoFee.toFixed(2)}
                      </p>
                    ) : null}
                    {row.bitcoinAddress && (
                      <p>
                        <b>BTC:</b> {row.bitcoinAddress}
                      </p>
                    )}
                    {row.litecoinAddress && (
                      <p>
                        <b>LTC:</b> {row.litecoinAddress}
                      </p>
                    )}
                    {row.dogecoinAddress && (
                      <p>
                        <b>DOGE:</b> {row.dogecoinAddress}
                      </p>
                    )}
                    {row.charityName && (
                      <p>
                        <b>Charity:</b> {row.charityName}
                      </p>
                    )}
                    {row.receiptEmail && (
                      <p>
                        <b>Receipt Email:</b> {row.receiptEmail}
                      </p>
                    )}
                    <p>
                      <b>Status:</b>{" "}
                      <span className={`status-tag status-${statusClass}`}>{row.status}</span>
                    </p>
                    {(row.deviceUserCount || row.ipUserCount) && (
                      <p>
                        <b>Fingerprint:</b>{" "}
                        {row.deviceUserCount ? `${row.deviceUserCount} users on device` : "—"}
                        {row.ipUserCount ? ` • ${row.ipUserCount} users on IP cluster` : ""}
                      </p>
                    )}
                    <p>
                      <b>Requested:</b> {formatDate(row.createdAt)}
                    </p>
                    <p>
                      <b>Risk:</b>{" "}
                      <span className={`suspicion-tag ${suspicionClass(row)}`}>{suspicionLabel(row)}</span>
                    </p>
                    {row.suspiciousReasons && row.suspiciousReasons.length > 0 && (
                      <ul className="suspicion-reasons">
                        {row.suspiciousReasons.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    )}
                    {row.status === "denied" && (
                      <div className="denial-note">
                        <p>
                          <b>Reason:</b> {row.denialReason ? row.denialReason : "No reason provided."}
                        </p>
                        <p className="denial-meta">{row.refunded ? "Refunded to user" : "No refund issued"}</p>
                      </div>
                    )}
                    {row.status === "pending" && (
                      <div className="admin-actions">
                        <button className="rb-btn admin-approve" onClick={() => openModal(row, "fulfill")}>
                          Mark Fulfilled
                        </button>
                        <button className="rb-btn rb-btn-secondary admin-deny" onClick={() => openModal(row, "deny")}>
                          Deny / Refund
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="admin-column">
      <div className="glassy-card admin-lookup-card">
        <h3 className="rb-section-title-small">User Lookup by UID</h3>
        <p className="dash-muted">Inspect account, payouts, offer events, and apply bans.</p>

        <div className="admin-lookup-row">
          <input
            type="text"
            value={lookupUid}
            onChange={(e) => setLookupUid(e.target.value)}
            placeholder="Enter user UID..."
          />
          <button className="rb-btn" onClick={handleLookup}>
            Lookup
          </button>
        </div>

        {lookupLoading && <p className="dash-muted">Loading...</p>}
        {lookupError && <p className="dash-muted error-text">{lookupError}</p>}

        {lookupProfile && (
          <div className="admin-lookup-result">
            <h4>Profile</h4>
            <div className="admin-profile-grid">
              <div>
                <p className="dash-label">UID</p>
                <p>{lookupProfile.id}</p>
              </div>
              <div>
                <p className="dash-label">Username</p>
                <p>{lookupProfile.username}</p>
              </div>
              <div>
                <p className="dash-label">Email</p>
                <p>{lookupProfile.email}</p>
              </div>
              <div>
                <p className="dash-label">Balance</p>
                <p>{formatCurrency(lookupProfile.balance)}</p>
              </div>
              <div>
                <p className="dash-label">Partner access</p>
                <p>{lookupProfile.partner ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="dash-label">Created</p>
                <p>{formatShortDate(lookupProfile.createdAt)}</p>
              </div>
            </div>
          </div>
        )}

        {lookupProfile && (
          <div className="glassy-card admin-lookup-card">
            <h4>Security &amp; device signals</h4>
            <div className="admin-profile-grid">
              <div>
                <p className="dash-label">Device ID</p>
                <p>{deviceInsight?.deviceId || lookupProfile.deviceId || "—"}</p>
              </div>
              <div>
                <p className="dash-label">Accounts on device</p>
                <p>{deviceInsight?.deviceUserCount ?? "—"}</p>
              </div>
              <div>
                <p className="dash-label">Accounts on IP cluster</p>
                <p>{deviceInsight?.ipUserCount ?? "—"}</p>
              </div>
              <div>
                <p className="dash-label">Last IP</p>
                <p>{deviceInsight?.ip || lookupProfile.lastIp || "—"}</p>
              </div>
              <div>
                <p className="dash-label">Last fingerprint</p>
                <p>{formatDate(deviceInsight?.lastSeen || lookupProfile.fingerprintUpdatedAt)}</p>
              </div>
            </div>

            {fingerprints.length > 0 && (
              <>
                <h5>Recent fingerprints</h5>
                <div className="admin-activity-list">
                  {fingerprints.map((fp) => (
                    <div key={fp.id || fp.deviceId} className="admin-activity-row">
                      <div>
                        <p className="dash-label">{fp.deviceId}</p>
                        <p className="dash-muted">{formatDate(fp.lastSeen)}</p>
                      </div>
                      <div className="admin-activity-amount">{fp.ip || fp.ipHash || "N/A"}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {lookupProfile && (
          <div className="admin-ban-controls">
            <h4>Ban Controls</h4>
            <div className="admin-ban-row">
              <label>Reason</label>
              <input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban"
              />
            </div>
            <div className="admin-ban-row">
              <label>Device ID</label>
              <input
                type="text"
                value={banDeviceId}
                onChange={(e) => setBanDeviceId(e.target.value)}
                placeholder="Enter device ID"
              />
            </div>
            <div className="admin-ban-row">
              <label>IP Address</label>
              <input
                type="text"
                value={banIp}
                onChange={(e) => setBanIp(e.target.value)}
                placeholder="Enter IP"
              />
            </div>
            <div className="admin-ban-buttons">
              <button className="rb-btn rb-btn-danger" onClick={handleBanUser}>
                Ban User
              </button>
              <button className="rb-btn rb-btn-secondary" onClick={handleBanDevice}>
                Ban Device
              </button>
              <button className="rb-btn rb-btn-secondary" onClick={handleBanIp}>
                Ban IP
              </button>
            </div>
          </div>
        )}

        <div className="admin-lookup-columns">
          {lookupPayouts.length > 0 && (
            <div className="admin-lookup-payouts">
              <h4>Recent Payouts & Donations</h4>
              {lookupPayouts.map((row) => (
                <div key={row.id} className="dash-card modern-card glassy-card">
                  <p>
                    <b>Type:</b> {row.type}
                  </p>
                  <p>
                    <b>Amount:</b> {formatCurrency(row.amount)}
                  </p>
                  <p>
                    <b>Method:</b> {row.method}
                  </p>
                  <p>
                    <b>Status:</b> {row.status}
                  </p>
                  <p>
                    <b>Requested:</b> {formatDate(row.createdAt)}
                  </p>
                </div>
              ))}
              <p className="dash-muted dash-footnote">Recent payouts shown (limit 20).</p>
            </div>
          )}

          {lookupEvents.length > 0 && (
            <div className="admin-lookup-events">
              <h4>Recent Offer Events</h4>
              <div className="admin-activity-list">
                {lookupEvents.map((e) => (
                  <div key={e.id} className="admin-activity-row">
                    <div>
                      <p className="dash-label">{e.type || e.source || "event"}</p>
                      <p className="dash-muted">{formatDate(e.createdAt)}</p>
                    </div>
                    <div className="admin-activity-amount">{formatCurrency(e.amount)}</div>
                  </div>
                ))}
              </div>
              <p className="dash-muted dash-footnote">Latest 25 credited offer events for this user.</p>
            </div>
          )}
        </div>

        {fraudLogs.length > 0 && (
          <div className="glassy-card admin-lookup-card">
            <h4>Fraud flags</h4>
            <div className="admin-activity-list">
              {fraudLogs.map((log) => (
                <div key={log.id} className="admin-activity-row">
                  <div>
                    <p className="dash-label">{log.type}</p>
                    <p className="dash-muted">{formatDate(log.createdAt)}</p>
                  </div>
                  <div className="admin-activity-amount">{log.source || log.txId || "flag"}</div>
                  {log.reasons?.length ? (
                    <p className="dash-muted">{log.reasons.join(", ")}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPartners = () => (
    <div className="admin-column">
      <div className="glassy-card admin-lookup-card">
        <h3 className="rb-section-title-small">Partner performance</h3>
        <p className="dash-muted">Aggregated from recent completed offers (latest 200).</p>
        <p className="dash-muted">
          Need a partner-facing view? <Link to="/partner">Open the partner dashboard</Link>.
        </p>
        {partnerLoading && <p className="dash-muted">Loading...</p>}
        {!partnerLoading && partnerStats.length === 0 && <p className="dash-muted">No partner data available.</p>}
        {!partnerLoading && partnerStats.length > 0 && (
          <div className="admin-activity-list">
            {partnerStats.map((p) => (
              <div key={p.source} className="admin-activity-row">
                <div>
                  <p className="dash-label">{p.source}</p>
                  <p className="dash-muted">{p.count} conversions</p>
                </div>
                <div className="admin-activity-amount">{formatCurrency(p.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="rb-content">
      <section className="dash-shell admin-shell">
        <div className="admin-header glassy-card neon-glow">
          <h2 className="rb-section-title">Admin — Payouts, Users & Activity</h2>
          <p className="rb-section-sub">
            Review cashouts, donations, analyze accounts, monitor activity, and manage risk.
          </p>
        </div>

        <div className="dash-tabs scrollable-tabs glassy-card">
          {(["analytics", "payouts", "users", "partners"] as Array<
            "analytics" | "payouts" | "users" | "partners"
          >).map((tab) => (
            <button
              key={tab}
              className={`dash-tab-btn ${activeTab === tab ? "dash-tab-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "analytics" && renderAnalytics()}
        {activeTab === "payouts" && renderPayouts()}
        {activeTab === "users" && renderUsers()}
        {activeTab === "partners" && renderPartners()}
      </section>

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
              <b>Amount:</b> {formatCurrency(actionRow.amount)} via {actionRow.method}
              {actionRow.cryptoFee ? (
                <>
                  <br />
                  <b>Crypto fee:</b> ${actionRow.cryptoFee.toFixed(2)}
                </>
              ) : null}
              {actionRow.bitcoinAddress ? (
                <>
                  <br />
                  <b>BTC:</b> {actionRow.bitcoinAddress}
                </>
              ) : null}
              {actionRow.litecoinAddress ? (
                <>
                  <br />
                  <b>LTC:</b> {actionRow.litecoinAddress}
                </>
              ) : null}
              {actionRow.dogecoinAddress ? (
                <>
                  <br />
                  <b>DOGE:</b> {actionRow.dogecoinAddress}
                </>
              ) : null}
              {(actionRow.deviceUserCount || actionRow.ipUserCount) && (
                <>
                  <br />
                  <b>Fingerprint:</b>{" "}
                  {actionRow.deviceUserCount ? `${actionRow.deviceUserCount} users on device` : "—"}
                  {actionRow.ipUserCount ? ` • ${actionRow.ipUserCount} users on IP cluster` : ""}
                </>
              )}
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
                  Refund {formatCurrency(actionRow.amount + (actionRow.cryptoFee || 0))} back to user
                  {actionRow.cryptoFee ? " (includes crypto fee)" : ""}
                </label>
              </>
            )}

            <div className="rb-modal-actions">
              <button onClick={handleAction} disabled={actionSaving} className="hb-btn">
                {actionSaving ? "Saving..." : "Confirm"}
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
