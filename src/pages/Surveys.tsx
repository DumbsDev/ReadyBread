// src/pages/Surveys.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import type { Survey } from "../types";
import "../surveys.css";
import { AntiFraudGate } from "../components/AntiFraudGate";

type SortMode = "best" | "payout" | "length" | "random";

interface CPXSurvey {
  id: string;
  name: string;
  minutes: number;
  payout: number;
  click_url: string;
  country?: string;
}

type MergedSurvey = {
  source: "bitlabs" | "cpx";
  id: string;
  payout: number;
  minutes: number;
  category: string;
  click_url: string;
  country?: string;
};

// Toggle BitLabs surveys on/off for quick testing.
const SHOW_BITLABS_SURVEYS = false;

export const Surveys: React.FC = () => {
  const { authUser, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [bitlabsSurveys, setBitlabsSurveys] = useState<Survey[]>([]);
  const [cpxSurveys, setCpxSurveys] = useState<CPXSurvey[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("best");
  const [surveysLoading, setSurveysLoading] = useState<boolean>(true);

  const BITLABS_API_KEY = "250f0833-3a86-4232-ae29-9b30026d1820";
  const CPX_APP_ID = "30102";
  const CPX_HASH = "yvxLR6x1Jc1CptNFfmrhzYlAu1XqVfsj";

  /* ---------------------------------------------------
     LOGIN / VERIFICATION CHECK
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

    void loadAllSurveys();
  }, [authUser, userLoading, navigate]);

  /* ---------------------------------------------------
     LOAD SURVEYS (BitLabs + CPX)
  --------------------------------------------------- */
  const loadAllSurveys = async () => {
    setSurveysLoading(true);
    await Promise.all([
      SHOW_BITLABS_SURVEYS ? loadBitlabsSurveys() : Promise.resolve(),
      loadCpxSurveys(),
    ]);
    setSurveysLoading(false);
  };

  const resolveUserIP = async (): Promise<string> => {
    const endpoints = [
      "https://api.ipify.org?format=json", // prefer IPv4 for CPX
      "https://api64.ipify.org?format=json", // fallback IPv6
    ];

    let ipv6Candidate: string | null = null;

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) continue;
        const json = await res.json();
        const ip = json?.ip as string | undefined;
        if (!ip) continue;

        if (ip.includes(":")) {
          ipv6Candidate = ipv6Candidate || ip;
          continue;
        }

        return ip;
      } catch (err) {
        console.warn("IP lookup failed:", err);
      }
    }

    return ipv6Candidate || "0.0.0.0";
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
      // Fetch user's IP (CPX requires ip_user) with fallback to IPv4 endpoint
      const resolvedIP = await resolveUserIP();
      const ipForCpx = resolvedIP.includes(":") ? "" : resolvedIP; // CPX is picky about IPv6

      const userAgent = navigator.userAgent || "";

      const url =
        `https://live-api.cpx-research.com/api/get-surveys.php?` +
        `app_id=${CPX_APP_ID}` +
        `&ext_user_id=${encodeURIComponent(authUser?.uid || "")}` +
        `&output_method=api` +
        (ipForCpx ? `&ip_user=${encodeURIComponent(ipForCpx)}` : "") +
        `&user_agent=${encodeURIComponent(userAgent)}` +
        `&limit=50` +
        `&secure_hash=${encodeURIComponent(CPX_HASH)}`;

      const res = await fetch(url);
      if (!res.ok) {
        console.warn("CPX returned non-200 status:", res.status);
        setCpxSurveys([]);
        return;
      }
      const json = await res.json();

      if (!json?.surveys || !Array.isArray(json.surveys)) {
        console.warn("CPX returned no surveys:", json);
        setCpxSurveys([]);
        return;
      }

      const mapped = (json.surveys as any[]).map((s) => ({
        id: String(s.id),
        name: s.name || "Survey",
        minutes: Number(s.loi || s.minutes || 10),
        payout: Number(s.payout || s.reward_usd || 0),
        click_url: String(s.href || s.link) || "",
        country: s.country || "?",
      }));
      setCpxSurveys(mapped);
    } catch (err) {
      console.error("Error loading CPX surveys:", err);
      setCpxSurveys([]);
    }
  };

  /* ---------------------------------------------------
     Click Handler for CPX / BitLabs
  --------------------------------------------------- */
  const handleStart = (s: MergedSurvey) => {
    if (s.source === "cpx") {
      const base = s.click_url;
      const url =
        `${base}` +
        `&app_id=${CPX_APP_ID}` +
        `&ext_user_id=${encodeURIComponent(authUser?.uid || "")}` +
        `&secure_hash=${encodeURIComponent(CPX_HASH)}` +
        `&username=${encodeURIComponent(authUser?.displayName || "")}` +
        `&email=${encodeURIComponent(authUser?.email || "")}` +
        `&subid_1=${encodeURIComponent(s.id)}` +
        `&subid_2=rb`;
      window.open(url, "_blank");
    } else {
      window.open(s.click_url, "_blank");
    }
  };

  /* ---------------------------------------------------
     MERGE + SORT SURVEYS
  --------------------------------------------------- */
  const mergedSurveys: MergedSurvey[] = [
    ...(SHOW_BITLABS_SURVEYS
      ? bitlabsSurveys.map((s): MergedSurvey => ({
          source: "bitlabs",
          id: s.id,
          payout: Number(s.cpi || 0),
          minutes: Number(s.loi || 0),
          category: s.category?.name || "Survey",
          click_url: s.click_url,
          country: s.country || "?",
        }))
      : []),
    ...cpxSurveys.map((s): MergedSurvey => ({
      source: "cpx",
      id: s.id,
      payout: s.payout,
      minutes: s.minutes,
      category: s.name,
      click_url: s.click_url,
      country: s.country,
    })),
  ];

  const getSortedSurveys = (): MergedSurvey[] => {
    const arr = [...mergedSurveys];
    if (sortMode === "payout") {
      arr.sort((a, b) => b.payout - a.payout);
    } else if (sortMode === "length") {
      arr.sort((a, b) => a.minutes - b.minutes);
    } else if (sortMode === "random") {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    return arr;
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

  return (
    <AntiFraudGate featureName="surveys">
      <main className="rb-content theme-surveys">
        <section className="earn-shell">
          {/* Header */}
          <div className="earn-header">
            <div>
              <h2 className="rb-section-title">
                <span className="emoji">dY'-</span> Surveys Fresh From The Oven
              </h2>
              <p className="rb-section-sub">
                Complete surveys from BitLabs &amp; CPX to earn dough instantly.
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 10,
                  fontSize: 13,
                }}
              >
                <span className="chip chip-time">
                  {totalSurveys > 0
                    ? `${totalSurveys} live surveys (${SHOW_BITLABS_SURVEYS ? "BitLabs + " : ""}CPX)`
                    : "Checking for surveys..."}
                </span>
                {bestPayout > 0 && (
                  <span className="chip chip-payout">
                    Top payout ~ ${bestPayout.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Sort buttons */}
            <div className="earn-sort">
              <span className="earn-sort-label">Sort by:</span>
              {(["best", "payout", "length", "random"] as SortMode[]).map((m) => (
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
              ))}
            </div>
          </div>

          {/* Survey grid */}
          <div id="survey-list" className="survey-list two-column">
            {surveysLoading ? (
              <div className="survey-empty">Loading surveys...</div>
            ) : finalSurveys.length === 0 ? (
              <div className="survey-empty">No surveys available right now.</div>
            ) : (
              finalSurveys.map((s) => {
                const borderColor = s.source === "cpx" ? "#02c59a" : "#0000D1";
                const minutes = s.minutes || "?";
                const payoutFormatted = `$${s.payout.toFixed(2)}`;

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
                      <div className="offer-tags" style={{ marginTop: 4 }}>
                        <span className="chip chip-payout">{payoutFormatted}</span>
                        <span className="chip chip-time">~{minutes} min</span>
                      </div>
                      <p className="survey-meta" style={{ marginTop: 6, fontSize: 13 }}>
                        <span>Country: {s.country || "?"}</span>
                      </p>
                    </div>
                    <div className="survey-actions">
                      <button className="survey-start-btn" onClick={() => handleStart(s)}>
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
    </AntiFraudGate>
  );
};

export default Surveys;
