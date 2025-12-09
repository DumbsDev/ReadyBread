// src/pages/RevU.tsx
import React, { useMemo, useState } from "react";
import { AntiFraudGate } from "../components/AntiFraudGate";
import { useUser } from "../contexts/UserContext";

const REVU_PUBLISHER_ID = "1481";
const REVU_API_KEY = "qJR5ywPMfmiVw3apne1W";

export const RevUWall: React.FC = () => {
  const { authUser, profile } = useUser();
  const userId = authUser?.uid || "guest";
  const sid3 = profile?.referralCode || profile?.username || "";
  const [wallError, setWallError] = useState(false);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      uid: userId,
      apiKey: REVU_API_KEY,
    });

    if (sid3) {
      params.set("sid3", sid3);
    }

    return `https://publishers.revenueuniverse.com/wallresp/${REVU_PUBLISHER_ID}/offers?${params.toString()}`;
  }, [userId, sid3]);

  return (
    <AntiFraudGate featureName="RevU offerwall">
      <main className="rb-content theme-surveys revu-shell">
        <section className="earn-shell">
          <div className="earn-header">
            <div>
              <h2 className="rb-section-title">RevU Offerwall</h2>
              <p className="rb-section-sub">
                Revenue Universe wall with apps, signups, and commerce trials.
                We pass your ReadyBread ID and referral code to them.
              </p>
              <h3>You are currently earning 50% + daily bonus of what's shown.</h3>
            </div>
          </div>

          <div className="revu-frame-wrap">
            <iframe
              title="RevU offerwall"
              src={iframeSrc}
              width="750"
              height="1400"
              allowFullScreen
              frameBorder="0"
              onError={() => setWallError(true)}
              onLoad={() => setWallError(false)}
            />
          </div>

          {wallError && (
            <div className="rb-card modern-card" style={{ marginTop: 12 }}>
              <h3>We couldn't load RevU in-page</h3>
              <p className="dash-muted">
                Open the wall directly and keep VPN/proxy off to avoid partner blocks.
              </p>
              <button
                type="button"
                className="survey-start-btn"
                onClick={() => window.open(iframeSrc, "_blank")}
              >
                Open RevU in a new tab
              </button>
            </div>
          )}

          <p className="rb-section-sub" style={{ marginTop: 10 }}>
            If the wall looks empty, disable VPN/proxy and refresh. Conversions
            track via your ReadyBread account and the RevU postback.
          </p>
        </section>
      </main>
    </AntiFraudGate>
  );
};

export default RevUWall;
