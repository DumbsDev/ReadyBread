const IP_CACHE_KEY = "rb-ip-cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface CachedIp {
  ip: string;
  ts: number;
}

const readCache = (): CachedIp | null => {
  try {
    const raw = sessionStorage.getItem(IP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIp;
    if (!parsed?.ip || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (ip: string) => {
  try {
    const payload: CachedIp = { ip, ts: Date.now() };
    sessionStorage.setItem(IP_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache errors
  }
};

/**
 * Resolve the client IP with caching and gentle fallback.
 */
export async function getClientIp(): Promise<string> {
  const cached = readCache();
  if (cached?.ip) return cached.ip;

  const endpoints = [
    "https://api.ipify.org?format=json",
    "https://api64.ipify.org?format=json",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const json = (await res.json()) as { ip?: string };
      if (json?.ip) {
        writeCache(json.ip);
        return json.ip;
      }
    } catch {
      // continue to next endpoint
    }
  }

  return "";
}
