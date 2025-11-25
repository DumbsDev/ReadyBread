// Lightweight VPN/Proxy/abuse check helper.
// Uses IPQualityScore when an API key is provided, otherwise falls back to
// GetIPIntel if a contact email is set. Defaults to "warn-only" when no
// provider is configured so the UI can still show an anti-fraud notice.
import { useCallback, useEffect, useState } from "react";

type Provider = "ipqualityscore" | "getipintel" | null;
type Status =
  | "idle"
  | "checking"
  | "allowed"
  | "blocked"
  | "warn"
  | "disabled"
  | "error";

export interface VpnCheckState {
  status: Status;
  loading: boolean;
  ip: string;
  provider: Provider;
  score: number | null;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  reason: string | null;
  raw?: any;
}

const IPQS_KEY =
  (import.meta as any)?.env?.VITE_IPQS_KEY ||
  (typeof window !== "undefined" ? (window as any).VITE_IPQS_KEY : "");

const GETIPINTEL_CONTACT =
  (import.meta as any)?.env?.VITE_GETIPINTEL_CONTACT ||
  (typeof window !== "undefined" ? (window as any).VITE_GETIPINTEL_CONTACT : "");

const IPQS_THRESHOLD = 75; // 0-100 fraud_score
const GETIPINTEL_THRESHOLD = 0.98; // 0-1 risk score

async function resolveIp(): Promise<string> {
  const endpoints = [
    "https://api.ipify.org?format=json",
    "https://api64.ipify.org?format=json",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const json = (await res.json()) as { ip?: string };
      if (json?.ip) return json.ip;
    } catch (err) {
      console.warn("IP lookup failed:", err);
    }
  }

  return "";
}

export function useVpnCheck(requireClean: boolean = true) {
  const [state, setState] = useState<VpnCheckState>({
    status: "idle",
    loading: true,
    ip: "",
    provider: null,
    score: null,
    isVpn: false,
    isProxy: false,
    isTor: false,
    reason: null,
  });

  const runCheck = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, status: "checking" }));

    const ip = await resolveIp();
    if (!ip) {
      setState((prev) => ({
        ...prev,
        loading: false,
        status: "error",
        ip,
        reason: "Unable to resolve IP",
      }));
      return;
    }

    // If no provider configured, only warn (do not block).
    if (!IPQS_KEY && !GETIPINTEL_CONTACT) {
      setState((prev) => ({
        ...prev,
        loading: false,
        status: "warn",
        ip,
        reason: "VPN checks disabled until an API key/contact is provided.",
      }));
      return;
    }

    // Prefer IPQualityScore if available
    if (IPQS_KEY) {
      try {
        const params = new URLSearchParams({
          strictness: "1",
          allow_public_access_points: "false",
          lighter_penalties: "false",
          mobile: "true",
          fast: "true",
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : "",
        });

        const url = `https://ipqualityscore.com/api/json/ip/${IPQS_KEY}/${encodeURIComponent(
          ip
        )}?${params.toString()}`;

        const res = await fetch(url);
        const data = await res.json();

        const fraudScore = Number(data?.fraud_score ?? 0);
        const isVpn = Boolean(data?.vpn || data?.active_vpn);
        const isProxy = Boolean(data?.proxy || data?.active_proxy);
        const isTor = Boolean(data?.tor);
        const recentAbuse = Boolean(data?.recent_abuse);

        const flagged =
          isVpn ||
          isProxy ||
          isTor ||
          recentAbuse ||
          fraudScore >= IPQS_THRESHOLD;

        setState({
          status: flagged && requireClean ? "blocked" : "allowed",
          loading: false,
          ip,
          provider: "ipqualityscore",
          score: Number.isFinite(fraudScore) ? fraudScore : null,
          isVpn,
          isProxy,
          isTor,
          reason: flagged
            ? `Traffic flagged by IPQualityScore (score ${fraudScore}).`
            : null,
          raw: data,
        });
        return;
      } catch (err) {
        console.error("IPQualityScore check failed:", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          status: "error",
          ip,
          reason: "IPQualityScore check failed.",
        }));
        return;
      }
    }

    // Fallback: GetIPIntel
    try {
      const url = `https://check.getipintel.net/check.php?ip=${encodeURIComponent(
        ip
      )}&contact=${encodeURIComponent(GETIPINTEL_CONTACT)}&format=json`;
      const res = await fetch(url);
      const data = await res.json();

      const score = Number(data?.result ?? 0);
      const flagged = score >= GETIPINTEL_THRESHOLD;

      setState({
        status: flagged && requireClean ? "blocked" : "allowed",
        loading: false,
        ip,
        provider: "getipintel",
        score: Number.isFinite(score) ? score : null,
        isVpn: flagged,
        isProxy: flagged,
        isTor: false,
        reason: flagged
          ? `Traffic flagged by GetIPIntel (score ${score.toFixed(2)}).`
          : null,
        raw: data,
      });
    } catch (err) {
      console.error("GetIPIntel check failed:", err);
      setState((prev) => ({
        ...prev,
        loading: false,
        status: "error",
        ip,
        reason: "GetIPIntel check failed.",
      }));
    }
  }, [requireClean]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  return {
    ...state,
    blocked: state.status === "blocked",
    shouldWarn: state.status === "warn",
    refresh: runCheck,
  };
}

