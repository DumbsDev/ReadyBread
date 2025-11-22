// src/pages/Surveys.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { User, Survey } from "../types";

interface SurveysProps {
  user: User | null;
}

type SortMode = "best" | "payout" | "length" | "random";

export const Surveys: React.FC<SurveysProps> = ({ user }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("best");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const BITLABS_API_KEY = "250f0833-3a86-4232-ae29-9b30026d1820";

  useEffect(() => {
    if (!user) {
      alert("Please log in to earn rewards.");
      navigate("/login");
      return;
    }
    loadSurveys();
  }, [user, navigate]);

  const loadSurveys = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const res = await fetch("https://api.bitlabs.ai/v2/client/surveys", {
        method: "GET",
        headers: {
          "X-Api-Token": BITLABS_API_KEY,
          "X-User-Id": user.uid,
          "X-Api-Sdk": "CUSTOM",
        },
      });

      const data = await res.json();
      setSurveys(data?.data?.surveys || []);
    } catch (err) {
      console.error("Error loading surveys:", err);
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  const getSortedSurveys = (): Survey[] => {
    const sorted = [...surveys];

    if (sortMode === "payout") {
      sorted.sort((a, b) => Number(b.cpi || 0) - Number(a.cpi || 0));
    } else if (sortMode === "length") {
      sorted.sort((a, b) => Number(a.loi || 0) - Number(b.loi || 0));
    } else if (sortMode === "random") {
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
    }
    return sorted;
  };

  const sortedSurveys = getSortedSurveys();

  // Small helper stats for the header chips
  const totalSurveys = surveys.length;
  const bestPayout = surveys.length
    ? Math.max(
        ...surveys.map((s) =>
          Number(s.cpi || (typeof s.value === "string" ? s.value.replace("$", "") : 0))
        )
      )
    : 0;

  return (
    <main className="rb-content theme-surveys">
      <section className="earn-shell">
        {/* Header / Sort bar */}
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">
              <span className="emoji">💭</span> Surveys Fresh From The Oven
            </h2>
            <p className="rb-section-sub">
              Complete surveys from our partners and earn some quick dough.
            </p>

            {/* Little glassy stats row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "10px",
                fontSize: "13px",
                opacity: 0.9,
              }}
            >
              <span className="chip chip-time">
                {totalSurveys > 0 ? `${totalSurveys} live surveys` : "Checking for surveys…"}
              </span>
              {bestPayout > 0 && (
                <span className="chip chip-payout">
                  Top payout ~ ${bestPayout.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* SORT BUTTONS */}
          <div className="earn-sort">
            <span className="earn-sort-label">Sort by:</span>

            {(["best", "payout", "length", "random"] as SortMode[]).map((mode) => (
              <button
                key={mode}
                className={`sort-btn ${sortMode === mode ? "sort-active" : ""}`}
                onClick={() => setSortMode(mode)}
              >
                {mode === "best"
                  ? "Best match"
                  : mode === "payout"
                  ? "Highest pay"
                  : mode === "length"
                  ? "Shortest"
                  : "Random"}
              </button>
            ))}
          </div>
        </div>

        {/* SURVEY LIST */}
        <div id="survey-list" className="survey-list">
          {loading ? (
            <div className="survey-empty">Loading surveys…</div>
          ) : sortedSurveys.length === 0 ? (
            <div className="survey-empty">
              No surveys available right now. Try again soon.
            </div>
          ) : (
            sortedSurveys.map((survey) => {
              const minutes = survey.loi ? Number(survey.loi).toFixed(0) : "?";
              const payout =
                survey.value || `$${Number(survey.cpi || 0).toFixed(2)}`;

              return (
                <div
                  key={survey.id}
                  className="survey-card rb-card modern-card"
                >
                  <div className="survey-main">
                    <h3 className="glow-soft">
                      {survey.category?.name || "Survey"}
                    </h3>

                    {/* reuse chip style from Games for a more unified neon look */}
                    <div className="offer-tags" style={{ marginTop: "4px" }}>
                      <span className="chip chip-payout">{payout}</span>
                      <span className="chip chip-time">
                        ~{minutes} min
                      </span>
                    </div>

                    <p
                      className="survey-meta"
                      style={{ marginTop: "6px", fontSize: "13px" }}
                    >
                      <span>Country: {survey.country || "?"}</span>
                    </p>
                  </div>

                  <div className="survey-actions">
                    <button
                      className="survey-start-btn"
                      onClick={() => window.open(survey.click_url, "_blank")}
                    >
                      Start survey
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
};
