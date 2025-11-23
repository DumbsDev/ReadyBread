// src/pages/Receipts.tsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

const BITLABS_API_KEY = "250f0833-3a86-4232-ae29-9b30026d1820";

export const Receipts: React.FC = () => {
  const navigate = useNavigate();

  // Pull global user (auth + profile)
  const { authUser } = useUser();

  /* ---------------------------------------------------
     LOGIN / VERIFICATION CHECK
  --------------------------------------------------- */
  useEffect(() => {
    if (!authUser) {
      alert("Please log in to use Magic Receipts.");
      navigate("/login");
      return;
    }

    if (!authUser.emailVerified) {
      alert("Please verify your email before earning.");
      navigate("/login");
      return;
    }
  }, [authUser, navigate]);

  // If still not logged in (redirect already handled)
  if (!authUser) {
    return (
      <main className="rb-content">
        <h2 className="rb-section-title">Magic Receipts</h2>
        <p className="rb-section-sub">
          Please log in to upload receipts and earn rewards.
        </p>
      </main>
    );
  }

  /* ---------------------------------------------------
     BUILD MAGIC RECEIPTS URL
  --------------------------------------------------- */
  const magicReceiptsUrl = `https://web.bitlabs.ai?token=${encodeURIComponent(
    BITLABS_API_KEY
  )}&uid=${encodeURIComponent(authUser.uid)}&display_mode=magic_receipts`;

  /* ---------------------------------------------------
     RENDER RECEIPTS PAGE
  --------------------------------------------------- */
  return (
    <main className="rb-content theme-receipts">
      <h2 className="rb-section-title">Magic Receipts</h2>
      <p className="rb-section-sub">
        Scan your grocery and retail receipts to earn extra bread. Rewards are
        credited once BitLabs confirms your receipt.
      </p>

      <div className="rb-card">
        <p className="dash-muted" style={{ marginBottom: "10px" }}>
          Powered by BitLabs Magic Receipts. Make sure to upload clear photos,
          and only receipts from supported stores.
        </p>

        {/* Optional open in new tab */}
        <button
          type="button"
          className="survey-start-btn"
          style={{ marginBottom: "12px" }}
          onClick={() => window.open(magicReceiptsUrl, "_blank")}
        >
          Open Magic Receipts in a new tab
        </button>

        {/* Embedded BitLabs experience */}
        <div
          className="rb-iframe-shell"
          style={{
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            minHeight: "540px",
          }}
        >
          <iframe
            src={magicReceiptsUrl}
            title="Magic Receipts"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    </main>
  );
};
