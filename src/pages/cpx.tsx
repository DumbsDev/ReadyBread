// src/pages/cpx.tsx
import React, { useMemo } from "react";
import { AntiFraudGate } from "../components/AntiFraudGate";
import { useUser } from "../contexts/UserContext";

const CPX_APP_ID = "30102";
const CPX_HASH =
  (import.meta as any)?.env?.VITE_CPX_HASH ||
  (typeof window !== "undefined" ? (window as any).VITE_CPX_HASH : "") ||
  "yvxLR6x1Jc1CptNFfmrhzYlAu1XqVfsj";

const POSTBACK_URL =
  "https://us-central1-readybread-56d81.cloudfunctions.net/cpxPostback?user_id={user_id}&amount_usd={amount_usd}&amount_local={amount_local}&trans_id={trans_id}&status={status}&offer_id={offer_id}&hash=OIN98MFDSLNFDS80IJF";

export const CPXWall: React.FC = () => {
  const { authUser, profile } = useUser();
  const userId = authUser?.uid || "guest";
  const username = profile?.username || authUser?.email?.split("@")[0] || "guest";
  const email = authUser?.email || "";

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      app_id: CPX_APP_ID,
      ext_user_id: userId,
      secure_hash: CPX_HASH,
      username,
      email,
      subid_1: "",
      subid_2: "",
    });
    return `https://offers.cpx-research.com/index.php?${params.toString()}`;
  }, [userId, username, email]);

  return (
    <AntiFraudGate featureName="CPX survey wall">
      <main className="rb-content theme-surveys revu-shell">
        <section className="earn-shell">
          <div className="earn-header">
            <div>
              <h2 className="rb-section-title">CPX Survey Wall</h2>
              <p className="rb-section-sub">
                Live CPX Research surveys. We pass your ReadyBread ID, username, and email directly to CPX.
                You earn 50% + streak bonus on credited amounts.
              </p>
              <p className="rb-section-sub">
                App ID: {CPX_APP_ID} &middot; Postback wired to ReadyBread Cloud Functions (see below).
              </p>
            </div>
          </div>

          <div className="revu-frame-wrap">
            <iframe
              title="CPX survey wall"
              src={iframeSrc}
              width="100%"
              height="2000"
              allowFullScreen
              frameBorder="0"
            />
          </div>

          <div className="rb-card modern-card glass-card" style={{ marginTop: 16 }}>
            <h3 className="rb-section-title">Integration details</h3>
            <p className="rb-section-sub">Postback URL (already deployed):</p>
            <code style={{ display: "block", wordBreak: "break-all" }}>{POSTBACK_URL}</code>
            <p className="rb-section-sub" style={{ marginTop: 8 }}>
              iframe template (auto-filled above):
            </p>
            <code style={{ display: "block", wordBreak: "break-all" }}>
              {`<iframe width="100%" frameBorder="0" height="2000px" src="https://offers.cpx-research.com/index.php?app_id=${CPX_APP_ID}&ext_user_id={unique_user_id}&secure_hash={secure_hash}&username={user_name}&email={user_email}&subid_1=&subid_2="></iframe>`}
            </code>
            <p className="rb-section-sub" style={{ marginTop: 8 }}>
              API docs: <a href="https://publisher.cpx-research.com/documentation/indexapi.php" target="_blank" rel="noreferrer">CPX Publisher API</a>
            </p>
          </div>
        </section>
      </main>
    </AntiFraudGate>
  );
};

export default CPXWall;
