// src/pages/Surveys.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import type { Survey } from "../types";
import "../surveys.css";

type SortMode = "best" | "payout" | "length" | "random";

interface CPXSurvey {
  id: string;
  name: string;
  minutes: number;
  payout: number;
  click_url: string;
  country?: string;
}

export const Surveys: React.FC = () => {
  const { authUser, loading: userLoading } = useUser();

  const [bitlabsSurveys, setBitlabsSurveys] = useState<Survey[]>([]);
  const [cpxSurveys, setCpxSurveys] = useState<CPXSurvey[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("best");
  const [surveysLoading, setSurveysLoading] = useState(true);

  const navigate = useNavigate();

  const BITLABS_API_KEY = "250f0833-3a86-4232-ae29-9b30026d1820";
  const CPX_APP_ID = "30102";
  const CPX_HASH = "yvxLR6x1Jc1CptNFfmrhzYlAu1XqVfsj";

  /* ---------------------------------------------------
     LOGIN CHECK
  --------------------------------------------------- */
  useEffect(() => {
    if (userLoading) return;

    if (!authUser) {
      alert("Please log in to earn rewards.");
      navigate("/login");
      return;
    }

    if (!authUser.emailVerified) {
      alert("Please verify your email before earning.");
      navigate("/login");
      return;
    }

    loadAllSurveys();
  }, [authUser, userLoading, navigate]);

  /* ---------------------------------------------------
     LOAD SURVEYS (BitLabs + CPX)
  --------------------------------------------------- */
  const loadAllSurveys = async () => {
    setSurveysLoading(true);

    await Promise.all([loadBitlabsSurveys(), loadCpxSurveys()]);

    setSurveysLoading(false);
  };

  const loadBitlabsSurveys = async () => {
    try {
      const res = await fetch("https://api.bitlabs.ai/v2/client/surveys", {
        method: "GET",
        headers: {
          "X-Api-Token": BITLABS_API_KEY,
          "X-User-Id": authUser?.uid || "UNKNOWN",
          "X-Api-Sdk": "CUSTOM",
        },
      });

      const data = await res.json();
      const surveys = data?.data?.surveys || [];
      setBitlabsSurveys(surveys);
    } catch (err) {
      console.error("Error loading BitLabs surveys:", err);
      setBitlabsSurveys([]);
    }
  };

const loadCpxSurveys = async () => {
  try {
    // 1. Get user's IP (CPX requires it)
    const ipRes = await fetch("https://api64.ipify.org?format=json");
    const ipJson = await ipRes.json();
    const userIP = ipJson?.ip || "8.8.8.8"; // fallback safe IP

    // 2. User agent
    const userAgent = navigator.userAgent;

    // 3. Build CPX URL
    const url =
      `https://live-api.cpx-research.com/api/get-surveys.php?` +
      `app_id=${CPX_APP_ID}` +
      `&ext_user_id=${authUser?.uid}` +
      `&output_method=api` +
      `&limit=50` +
      `&ip_user=${encodeURIComponent(userIP)}` +
      `&user_agent=${encodeURIComponent(userAgent)}` +
      `&secure_hash=${CPX_HASH}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!json?.surveys || !Array.isArray(json.surveys)) {
      console.warn("CPX returned no surveys:", json);
      setCpxSurveys([]);
      return;
    }

    const mapped = json.surveys.map((s: any) => ({
      id: String(s?.id),
      name: s?.name || "Survey",
      minutes: Number(s?.loi || 10),
      payout: Number(s?.reward_usd || 0),
      click_url: s?.link || "#",
      country: s?.country || "?",
    })) as CPXSurvey[];

    setCpxSurveys(mapped);
  } catch (err) {
    console.error("Error loading CPX surveys:", err);
    setCpxSurveys([]);
  }
};


  /* ---------------------------------------------------
     MERGE + SORT SURVEYS
  --------------------------------------------------- */
  const mergedSurveys = [
    ...bitlabsSurveys.map((s) => ({
      source: "bitlabs",
      id: s.id,
      payout: Number(s.cpi || 0),
      minutes: Number(s.loi || 0),
      category: s.category?.name || "Survey",
      click_url: s.click_url,
      country: s.country,
    })),
    ...cpxSurveys.map((s) => ({
      source: "cpx",
      id: s.id,
      payout: s.payout,
      minutes: s.minutes,
      category: s.name,
      click_url: s.click_url,
      country: s.country,
    })),
  ];

  const getSortedSurveys = () => {
    const sorted = [...mergedSurveys];

    if (sortMode === "payout") {
      sorted.sort((a, b) => b.payout - a.payout);
    } else if (sortMode === "length") {
      sorted.sort((a, b) => a.minutes - b.minutes);
    } else if (sortMode === "random") {
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
    }

    return sorted;
  };

  const finalSurveys = getSortedSurveys();

  const totalSurveys = finalSurveys.length;
  const bestPayout = finalSurveys.length
    ? Math.max(...finalSurveys.map((s) => s.payout))
    : 0;

  if (userLoading) {
    return (
      <main className="rb-content theme-surveys">
        <section className="earn-shell">
          <p className="rb-section-sub">Checking your account...</p>
        </section>
      </main>
    );
  }

  /* ---------------------------------------------------
     RENDER
  --------------------------------------------------- */
  return (
    <main className="rb-content theme-surveys">
      <section className="earn-shell">

        {/* HEADER */}
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">
              <span className="emoji">💭</span> Surveys Fresh From The Oven
            </h2>
            <p className="rb-section-sub">
              Complete surveys from BitLabs & CPX to earn dough instantly.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px", fontSize: "13px" }}>
              <span className="chip chip-time">
                {totalSurveys > 0
                  ? `${totalSurveys} live surveys`
                  : "Checking for surveys…"}
              </span>
              {bestPayout > 0 && (
                <span className="chip chip-payout">
                  Top payout ~ ${bestPayout.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* SORT */}
          <div className="earn-sort">
            <span className="earn-sort-label">Sort by:</span>
            {(["best", "payout", "length", "random"] as SortMode[]).map(
              (m) => (
                <button
                  key={m}
                  className={`sort-btn ${sortMode === m ? "sort-active" : ""}`}
                  onClick={() => setSortMode(m)}
                >
                  {m === "best"
                    ? "Best match"
                    : m === "payout"
                    ? "Highest pay"
                    : m === "length"
                    ? "Shortest"
                    : "Random"}
                </button>
              )
            )}
          </div>
        </div>

        {/* SURVEY LIST */}
        <div id="survey-list" className="survey-list two-column">
          {surveysLoading ? (
            <div className="survey-empty">Loading surveys...</div>
          ) : finalSurveys.length === 0 ? (
            <div className="survey-empty">No surveys available right now.</div>
          ) : (
            finalSurveys.map((s) => {
              const borderColor = s.source === "cpx" ? "#02c59a" : "#0000D1";
              const minutes = s.minutes || "?";
              const payout = `$${Number(s.payout).toFixed(2)}`;

              return (
                <div
                  key={`${s.source}-${s.id}`}
                  className="survey-card rb-card modern-card"
                  style={{
                    border: `2px solid ${borderColor}`,
                    boxShadow: `0 0 8px ${borderColor}55`,
                  }}
                >
                  <div className="survey-main">
                    <h3 className="glow-soft">{s.category}</h3>

                    <div className="offer-tags" style={{ marginTop: "4px" }}>
                      <span className="chip chip-payout">{payout}</span>
                      <span className="chip chip-time">~{minutes} min</span>
                    </div>

                    <p className="survey-meta" style={{ marginTop: "6px", fontSize: "13px" }}>
                      <span>Country: {s.country || "?"}</span>
                    </p>
                  </div>

                  <div className="survey-actions">
                    <button
                      className="survey-start-btn"
                      onClick={() => window.open(s.click_url, "_blank")}
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

export default Surveys;
