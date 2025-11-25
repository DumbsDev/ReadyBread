import React from "react";
import { useVpnCheck } from "../hooks/useVpnCheck";

interface AntiFraudGateProps {
  children: React.ReactNode;
  requireClean?: boolean;
  featureName?: string;
}

/**
 * Blocks or warns when VPN/proxy/high-risk traffic is detected.
 * A provider key must be supplied via VITE_IPQS_KEY or VITE_GETIPINTEL_CONTACT
 * to enable hard blocking; otherwise a warning banner is shown.
 */
export const AntiFraudGate: React.FC<AntiFraudGateProps> = ({
  children,
  requireClean = true,
  featureName = "offers",
}) => {
  const vpn = useVpnCheck(requireClean);

  if (vpn.loading) {
    return (
      <main className="rb-content anti-fraud-shell">
        <section className="rb-card anti-fraud-card">
          <p className="rb-section-sub">Running VPN/proxy check…</p>
        </section>
      </main>
    );
  }

  return (
    <>
      {(vpn.shouldWarn || vpn.blocked) && (
        <div className="anti-fraud-banner">
          {vpn.blocked
            ? `VPN/proxy/high-risk traffic detected. You can continue to ${featureName}, but for best results turn off VPNs and avoid shared proxies.`
            : `VPN/proxy checks are active for ${featureName}. Add a VITE_IPQS_KEY or VITE_GETIPINTEL_CONTACT for stricter screening if needed.`}
        </div>
      )}
      {children}
    </>
  );
};
