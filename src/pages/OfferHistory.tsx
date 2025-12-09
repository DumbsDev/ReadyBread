import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";
import { useUser } from "../contexts/UserContext";

interface OfferEvent {
  id: string;
  offerId?: string;
  amount?: number;
  type?: string;
  source?: string;
  createdAt?: any;
}

type FilterTab = "all" | "surveys" | "games" | "offerwalls" | "quests" | "bonus";

const filterMatches = (item: OfferEvent, filter: FilterTab) => {
  const type = (item.type || "").toString().toLowerCase();
  const source = (item.source || "").toString().toLowerCase();

  if (filter === "all") return true;
  if (filter === "surveys") return type === "survey" || source.includes("survey");
  if (filter === "games") return type === "game" || source.includes("game");
  if (filter === "offerwalls")
    return (
      source.includes("wall") ||
      ["adgem", "kiwiwall", "revu", "ayet", "cpx"].some((s) =>
        (type + source).includes(s)
      )
    );
  if (filter === "quests") return type === "quest" || source.includes("quest");
  if (filter === "bonus")
    return type === "bonus" || source.includes("bonus") || source.includes("pwa");
  return true;
};

const formatDate = (ts: any) => {
  if (!ts) return "--";
  if (ts.toDate) return ts.toDate().toLocaleString();
  if (ts instanceof Date) return ts.toLocaleString();
  return "--";
};

export const OfferHistoryPage: React.FC = () => {
  const { authUser, user } = useUser();
  const [history, setHistory] = useState<OfferEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const ref = collection(db, "users", authUser.uid, "offers");
        const snap = await getDocs(
          query(ref, orderBy("createdAt", "desc"), limit(150))
        );
        setHistory(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );
      } catch (err) {
        console.error(err);
        setError("Failed to load offer history.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authUser]);

  const filtered = useMemo(
    () => history.filter((item) => filterMatches(item, filter)),
    [history, filter]
  );

  const totals = useMemo(() => {
    const sum = history.reduce((acc, h) => acc + (Number(h.amount) || 0), 0);
    const today = history.filter((h) => {
      const d = h.createdAt?.toDate?.() as Date | undefined;
      if (!d) return false;
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }).length;
    return { sum, count: history.length, today };
  }, [history]);

  if (!authUser) {
    return (
      <main className="rb-content theme-surveys">
        <section className="earn-shell">
          <div className="rb-card modern-card">
            <h2>Offer history</h2>
            <p className="dash-muted">
              Please <Link to="/login">log in</Link> to view your full offer history.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="rb-content theme-surveys">
      <section className="earn-shell">
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">Offer history</h2>
            <p className="rb-section-sub">
              Every credited survey, game, offerwall, receipt, and bonus attached to{" "}
              {user?.username || "your account"}.
            </p>
          </div>
          <div className="dash-summary-grid">
            <div className="glassy-card admin-summary-card">
              <p className="dash-label">Total earned</p>
              <h3>${totals.sum.toFixed(2)}</h3>
            </div>
            <div className="glassy-card admin-summary-card">
              <p className="dash-label">History entries</p>
              <h3>{totals.count}</h3>
            </div>
            <div className="glassy-card admin-summary-card">
              <p className="dash-label">Today</p>
              <h3>{totals.today}</h3>
            </div>
          </div>
        </div>

        <div className="dash-tabs scrollable-tabs glassy-card">
          {(["all", "surveys", "games", "offerwalls", "quests", "bonus"] as FilterTab[]).map(
            (tab) => (
              <button
                key={tab}
                className={`dash-tab-btn ${filter === tab ? "dash-tab-active" : ""}`}
                onClick={() => setFilter(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            )
          )}
        </div>

        {loading && <p className="dash-muted">Loading...</p>}
        {error && <p className="dash-muted error-text">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="rb-card modern-card">
            <p className="dash-muted">No history yet. Complete a survey or offer to see it here.</p>
            <div className="peek-chip">
              <Link to="/offerwalls">Open offer walls</Link>
              <span>•</span>
              <Link to="/surveys">Try surveys</Link>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="offer-history-grid">
            {filtered.map((item) => {
              const amount = Number(item.amount) || 0;
              const type = (item.type || item.source || "offer").toString();
              return (
                <div key={item.id} className="rb-card modern-card glassy-card">
                  <div className="offer-history-row">
                    <div>
                      <p className="dash-label">{type}</p>
                      <p className="dash-muted">{formatDate(item.createdAt)}</p>
                    </div>
                    <div className="admin-activity-amount">
                      ${amount.toFixed(2)}
                    </div>
                  </div>
                  <p className="dash-muted">
                    Source: {item.source || "unknown"} · ID: {item.offerId || item.id}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};

export default OfferHistoryPage;
