export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  const mq = window.matchMedia("(display-mode: standalone)");
  const isStandaloneMQ = mq && mq.matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;

  return Boolean(isStandaloneMQ || isIOSStandalone);
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /iphone|ipad|ipod/i.test(ua || "");
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /android|iphone|ipad|ipod|mobile/i.test(ua || "");
}
