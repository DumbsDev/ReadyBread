// src/pages/KiwiWall.tsx
import React, { useMemo } from "react";
import { AntiFraudGate } from "../components/AntiFraudGate";
import { useUser } from "../contexts/UserContext";

const KIWI_WALL_ID = "crlk6jn5o5msasdkwphkgb4ui53opiht";

export const KiwiWall: React.FC = () => {
  const { authUser } = useUser();
  const userId = authUser?.uid || "guest";

  const iframeSrc = useMemo(
    () =>
      `https://www.kiwiwall.com/wall/${KIWI_WALL_ID}/${encodeURIComponent(
        userId
      )}`,
    [userId]
  );

  return (
    <AntiFraudGate featureName="KiwiWall offerwall">
      <main className="rb-content theme-surveys kiwiwall-shell">
        <section className="earn-shell">
          <div className="earn-header">
            <div>
              <h2 className="rb-section-title">KiwiWall Offerwall</h2>
              <p className="rb-section-sub">
                Apps, signups, and commerce trials. The wall is tied to your
                ReadyBread ID for tracking. Turn off VPNs for best fill.
              </p>
            </div>
          </div>

          <div className="kiwiwall-frame-wrap">
            <iframe
              title="KiwiWall"
              src={iframeSrc}
              width="750"
              height="1400"
              allowFullScreen
              frameBorder="0"
            />
          </div>

          <p className="rb-section-sub" style={{ marginTop: 10 }}>
            If the wall looks empty, disable VPN/proxy and refresh. Conversions
            track via your ReadyBread account and the KiwiWall postback.
          </p>
        </section>
      </main>
    </AntiFraudGate>
  );
};

export default KiwiWall;
