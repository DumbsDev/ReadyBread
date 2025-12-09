import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";
import { useUser } from "../contexts/UserContext";
import AccessDenied from "./prefabs/AccessDenied";

interface PartnerOffer {
  id: string;
  uid?: string;
  source?: string;
  type?: string;
  payout?: number;
  partnerSource?: string;
  payoutScaled?: number;
  creditedAt?: any;
}

interface FraudFlag {
  id: string;
  source?: string | null;
  type?: string;
  reasons?: string[];
  createdAt?: any;
}

const formatDate = (ts: any) => {
  if (!ts) return "--";
  if (ts.toDate) return ts.toDate().toLocaleString();
  if (ts instanceof Date) return ts.toLocaleString();
  return "--";
};

export const PartnerDashboard: React.FC = () => {
  const { authUser, profile, admin } = useUser();
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"recent" | "partner">("recent");
  const [selectedPartner, setSelectedPartner] = useState<string>("all");

  const partnerSources =
    profile?.partnerSources?.map((s) => s.toLowerCase()) || [];
  const hasPartnerLabel = profile?.partner === true || (profile as any)?.parter === true;
  const partnerAccess = admin || hasPartnerLabel || partnerSources.length > 0;

  useEffect(() => {
    if (!authUser) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(
          query(collection(db, "completedOffers"), orderBy("creditedAt", "desc"), limit(200))
        );
        setOffers(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );

        const flagSnap = await getDocs(query(collection(db, "fraudLogs"), limit(50)));
        setFlags(
          flagSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );
      } catch (err) {
        console.error(err);
        setError("Failed to load partner stats.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authUser]);

  const normalizedOffers = useMemo(() => {
    return offers.map((o) => {
      const rawSource = (o.source || o.type || "unknown").toString();
      const lower = rawSource.toLowerCase();
      let partnerSource = rawSource || "unknown";
      if (lower.includes("cpx")) partnerSource = "cpx";
      else if (lower.includes("revu")) partnerSource = "revu";
      return {
        ...o,
        partnerSource,
        payoutScaled: (Number(o.payout) || 0) / 100,
      };
    });
  }, [offers]);

  const filteredOffers = useMemo(() => {
    if (admin || partnerSources.length === 0) return normalizedOffers;
    return normalizedOffers.filter((o) =>
      partnerSources.includes((o.partnerSource || "").toString().toLowerCase())
    );
  }, [normalizedOffers, partnerSources, admin]);

  const filteredFlags = useMemo(() => {
    if (admin || partnerSources.length === 0) return flags;
    return flags.filter((f) =>
      partnerSources.includes((f.source || "").toString().toLowerCase())
    );
  }, [flags, partnerSources, admin]);

  const sortedOffers = useMemo(() => {
    const base =
      selectedPartner === "all"
        ? filteredOffers
        : filteredOffers.filter(
            (o) =>
              (o.partnerSource || "")
                .toString()
                .toLowerCase() === selectedPartner.toLowerCase()
          );

    if (sortMode === "partner") {
      return [...base].sort((a, b) => {
        const sa = (a.source || "").toString().toLowerCase();
        const sb = (b.source || "").toString().toLowerCase();
        if (sa === sb) {
          const ta = a.creditedAt?.toMillis?.() || 0;
          const tb = b.creditedAt?.toMillis?.() || 0;
          return tb - ta;
        }
        return sa.localeCompare(sb);
      });
    }
    return base;
  }, [filteredOffers, sortMode, selectedPartner]);

  const dauWeek = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const unique = new Set<string>();
    filteredOffers.forEach((o) => {
      const ts = o.creditedAt?.toMillis?.() || 0;
      if (ts >= sevenDaysAgo && o.uid) unique.add(o.uid);
    });
    return unique.size / 7;
  }, [filteredOffers]);

  const stats = useMemo(() => {
    const total = filteredOffers.reduce(
      (sum, o) => sum + (Number(o.payoutScaled) || 0),
      0
    );
    const avg = filteredOffers.length > 0 ? total / filteredOffers.length : 0;
    const users = new Set(filteredOffers.map((o) => o.uid));
    return { total, count: filteredOffers.length, avg, users: users.size };
  }, [filteredOffers]);

  if (!authUser || !partnerAccess) {
    return <AccessDenied message="Partner dashboard requires partner or admin access." />;
  }

  return (
    <main className="rb-content theme-games">
      <section className="earn-shell">
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">Partner dashboard</h2>
            <p className="rb-section-sub">
              {admin
                ? "Admin view across all sources."
                : `Showing data for ${partnerSources.join(", ")}`}
            </p>
          </div>
        </div>

        {error && <p className="dash-muted error-text">{error}</p>}
        {loading && <p className="dash-muted">Loading partner stats...</p>}

        {!loading && (
          <>
            <div className="admin-summary-grid">
              <div className="glassy-card admin-summary-card">
                <p className="dash-label">Conversions</p>
                <h3>{stats.count}</h3>
                <p className="dash-muted">{stats.users} unique users</p>
              </div>
              <div className="glassy-card admin-summary-card">
                <p className="dash-label">Total payout</p>
                <h3>${stats.total.toFixed(2)}</h3>
                <p className="dash-muted">Avg ${stats.avg.toFixed(2)}</p>
              </div>
              <div className="glassy-card admin-summary-card">
                <p className="dash-label">DAU / week</p>
                <h3>{dauWeek.toFixed(2)}</h3>
                <p className="dash-muted">Unique users last 7d / 7</p>
              </div>
            </div>

            <div className="glassy-card admin-lookup-card" style={{ marginBottom: 12 }}>
              <div className="dash-tabs scrollable-tabs">
                {(["recent", "partner"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`dash-tab-btn ${sortMode === mode ? "dash-tab-active" : ""}`}
                    onClick={() => setSortMode(mode)}
                  >
                    {mode === "recent" ? "Sort by recent" : "Sort by partner"}
                  </button>
                ))}
              </div>
              {sortMode === "partner" && (
                <div className="partner-chip-row">
                  <button
                    className={`dash-tab-btn ${selectedPartner === "all" ? "dash-tab-active" : ""}`}
                    onClick={() => setSelectedPartner("all")}
                  >
                    All
                  </button>
                  {Array.from(
                    new Set(
                      filteredOffers                            
                        .map((o) => (o.partnerSource || o.source || "").toString())
                        .filter(Boolean)
                    )
                  ).map((src) => (
                    <button
                      key={src}
                      className={`dash-tab-btn ${
                        selectedPartner.toLowerCase() === src.toLowerCase()
                          ? "dash-tab-active"
                          : ""
                      }`}
                      onClick={() => setSelectedPartner(src)}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-activity-list glassy-card admin-lookup-card">
              <h3 className="rb-section-title-small">Latest conversions</h3>
              {sortedOffers.slice(0, 40).map((o) => (
                <div key={o.id} className="admin-activity-row">
                  <div>
                    <p className="dash-label">{o.partnerSource || o.source || "offer"}</p>
                    <p className="dash-muted">{formatDate(o.creditedAt)}</p>
                  </div>
                  <div className="admin-activity-amount">
                    ${(Number(o.payoutScaled) || 0).toFixed(2)}
                  </div>
                </div>
              ))}
              {filteredOffers.length === 0 && <p className="dash-muted">No conversions yet.</p>}
            </div>

              {filteredFlags.length > 0 && (
                <div className="glassy-card admin-lookup-card">
                  <h3 className="rb-section-title-small">Fraud flags</h3>
                  <div className="admin-activity-list">
                    {filteredFlags.map((f) => (
                      <div key={f.id} className="admin-activity-row">
                        <div>
                          <p className="dash-label">{f.type || "flag"}</p>
                          <p className="dash-muted">{formatDate(f.createdAt)}</p>
                        </div>
                        <div className="admin-activity-amount">{f.source || "velocity"}</div>
                        {f.reasons?.length ? (
                          <p className="dash-muted">{f.reasons.join(", ")}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}
      </section>
    </main>
  );
};

export default PartnerDashboard;
