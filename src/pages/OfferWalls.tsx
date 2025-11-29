// src/pages/OfferWalls.tsx
import React from "react";
import { useUser } from "../contexts/UserContext";
import { AntiFraudGate } from "../components/AntiFraudGate";

type WallStatus = "live" | "ready" | "pending";

interface WallConfig {
  id: string;
  name: string;
  status: WallStatus;
  description: string;
  requires: string[];
  buildUrl: (userId: string) => string | null;
  note?: string;
}

const getEnv = (key: string): string => {
  const meta = (import.meta as any)?.env?.[key];
  const winVal = typeof window !== "undefined" ? (window as any)[key] : "";
  return (meta || winVal || "").toString();
};

const wallConfigs: WallConfig[] = [
  {
    id: "kiwiwall",
    name: "KiwiWall",
    status: "live",
    description:
      "Offerwall with apps, signups, and mobile trials. Embedded and tied to your ReadyBread ID.",
    requires: [],
    buildUrl: () => `/kiwiwall`,
    note: "Live (embedded in-site)",
  },
  {
    id: "revu",
    name: "RevU",
    status: "live",
    description:
      "Revenue Universe wall with apps, signups, and commerce trials. UID is tied to your ReadyBread account.",
    requires: [],
    buildUrl: () => "/revu",
    note: "Live (embedded in-site)",
  },
  {
    id: "cpx",
    name: "CPX Research",
    status: "ready",
    description: "Daily survey inventory with smart routing. Already wired into our Surveys page, and available here as a dedicated wall.",
    requires: ["OIN98MFDSLNFDS80IJF", "VITE_CPX_HASH"],
    buildUrl: (userId: string) => {
      const appId = getEnv("VITE_CPX_APP_ID") || "30102";
      const hash = getEnv("VITE_CPX_HASH") || "yvxLR6x1Jc1CptNFfmrhzYlAu1XqVfsj";
      return `https://offers.cpx-research.com/index.php?app_id=${appId}&ext_user_id=${encodeURIComponent(
        userId
      )}&secure_hash=${encodeURIComponent(hash)}&output_method=iframe`;
    },
    note: "Live",
  },
  {
    id: "lootably",
    name: "Lootably",
    status: "ready",
    description: "High-engagement surveys and app offers with strong US/CA fill. Ready to launch once API key is present.",
    requires: ["VITE_LOOTABLY_API_KEY"],
    buildUrl: (userId: string) => {
      const key = getEnv("VITE_LOOTABLY_API_KEY");
      if (!key) return null;
      return `https://wall.lootably.com/?api_key=${encodeURIComponent(
        key
      )}&uid=${encodeURIComponent(userId)}&source=readybread`;
    },
    note: "Waiting on API key",
  },
  {
    id: "offertoro",
    name: "OfferToro",
    status: "ready",
    description: "Classic offerwall with apps, signups, and commerce trials. Good for filler inventory and GEO breadth.",
    requires: ["VITE_OFFERTORO_APP_ID"],
    buildUrl: (userId: string) => {
      const appId = getEnv("VITE_OFFERTORO_APP_ID");
      if (!appId) return null;
      return `https://www.offertoro.com/ifr/show/${encodeURIComponent(
        appId
      )}/${encodeURIComponent(userId)}/?ot_source=readybread`;
    },
    note: "Ready once app id is added",
  },
  {
    id: "magic-receipts",
    name: "BitLabs Magic Receipts",
    status: "ready",
    description: "Receipt uploads via BitLabs. Already embedded in ReadyBread with server-side validation.",
    requires: [],
    buildUrl: () => "/receipts",
    note: "Live (opens in-site)",
  },
  {
    id: "bitlabs",
    name: "BitLabs Surveys",
    status: "ready",
    description: "Primary survey rail. Auto-routes based on device and GEO. VPN and fraud screening enforced.",
    requires: [],
    buildUrl: () => "/surveys",
    note: "Live (opens in-site)",
  },
];

export const OfferWalls: React.FC = () => {
  const { authUser, loading } = useUser();
  const userId = authUser?.uid || "guest";

  <h1>Please note: This is only for partners to see for now. Once we go public, non-supported/partnered brands will be removed, however their implentation will stay in the code (even if the user doesn't see) in case of future partnership.</h1>

  const cards = wallConfigs.map((wall) => {
    const missing = wall.requires.filter((key) => !getEnv(key));
    const url = wall.buildUrl(userId);
    const ready = missing.length === 0 && !!url;

    return {
      ...wall,
      missing,
      url,
      ready,
      statusLabel:
        wall.status === "live"
          ? "Live"
          : wall.status === "ready"
          ? "Ready"
          : "Pending",
    };
  });

  const handleLaunch = (url: string | null) => {
    if (!url) return;
    if (url.startsWith("/")) {
      window.location.href = url;
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  if (loading) {
    return (
      <main className="rb-content theme-surveys">
        <section className="earn-shell">
          <p className="rb-section-sub">Checking your account...</p>
        </section>
      </main>
    );
  }

  const showLoginNudge = !authUser;

  return (
    <AntiFraudGate featureName="offer walls">
      <main className="rb-content theme-surveys">
        <section className="earn-shell">
          <div className="earn-header">
            <div>
              <h2 className="rb-section-title">Offer Wall Hub</h2>
              <p className="rb-section-sub">
                Central place for Lootably, OfferToro, RevU, CPX, and BitLabs.
                VPN/proxy users may see fewer offers, but we do not block shared IPs (dorms welcome).
              </p>
              {showLoginNudge && (
                <div className="anti-fraud-banner" style={{ marginTop: 10 }}>
                  Please log in to generate wall links tied to your account.
                </div>
              )}
            </div>
          </div>

          <div className="offerwall-grid">
            {cards.map((wall) => (
              <div key={wall.id} className="offerwall-card rb-card modern-card">
                <div className="offerwall-header">
                  <div>
                    <p className="status-chip">{wall.statusLabel}</p>
                    <h3 className="glow-soft">{wall.name}</h3>
                  </div>
                  {wall.note && <span className="offerwall-note">{wall.note}</span>}
                </div>

                <p className="offerwall-desc">{wall.description}</p>

                {wall.missing.length > 0 && (
                  <div className="missing-keys">
                    Not implemented/parterned, ready for immediate implementation.
                  </div>
                )}

                <div className="offerwall-actions">
                  <button
                    type="button"
                    className="survey-start-btn"
                    disabled={!wall.ready || showLoginNudge}
                    onClick={() => handleLaunch(wall.url)}
                  >
                    {wall.ready ? "Launch wall" : "Add API keys to launch"}
                  </button>
                  {wall.status !== "live" && (
                    <p className="offerwall-small">
                      Add the required keys in your .env to enable this wall.
                    </p>
                  )}
                  {wall.status === "live" && (
                    <p className="offerwall-small">
                      Live and testable. If a partner needs proof, send them this hub.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AntiFraudGate>
  );
};

export default OfferWalls;
