import React, { useEffect, useRef, useState } from "react";

const DEFAULT_SITE_KEY =
  (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY ||
  "6LdHlCMsAAAAAHolS9xb7kO7uFRc6H5-j_E8hYKm";

let scriptLoading: Promise<void> | null = null;

const loadScript = () => {
  if ((window as any).grecaptcha) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[src*="google.com/recaptcha/api.js"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA script"));
    document.head.appendChild(script);
  });
  return scriptLoading;
};

const waitForGreCaptcha = (timeoutMs = 5000): Promise<any> => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const gc = (window as any).grecaptcha;
      if (gc?.ready && gc.render) {
        resolve(gc);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error("grecaptcha not available"));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
};

type Props = {
  onChange: (token: string | null) => void;
  siteKey?: string;
  theme?: "light" | "dark";
  className?: string;
};

export const ReCaptchaBox: React.FC<Props> = ({
  onChange,
  siteKey = DEFAULT_SITE_KEY,
  theme = "light",
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widgetId, setWidgetId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  useEffect(() => {
    let isMounted = true;
    setStatus("loading");
    loadScript()
      .then(() => waitForGreCaptcha())
      .then(() => {
        if (!isMounted || !containerRef.current) return;
        const grecaptcha = (window as any).grecaptcha;
        grecaptcha.ready(() => {
          if (!isMounted || !containerRef.current) return;
          const id = grecaptcha.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: (token: string) => onChange(token),
            "expired-callback": () => onChange(null),
            "error-callback": () => onChange(null),
          });
          setWidgetId(id);
          setStatus("ready");
        });
      })
      .catch((err) => {
        console.error("reCAPTCHA load failed", err);
        if (isMounted) {
          setStatus("error");
          onChange(null);
        }
      });

    return () => {
      isMounted = false;
      if (widgetId !== null && (window as any).grecaptcha?.reset) {
        (window as any).grecaptcha.reset(widgetId);
      }
    };
  }, [siteKey, theme, onChange]);

  return (
    <div className={className} style={{ minHeight: 78 }}>
      <div ref={containerRef} />
      {status !== "ready" && (
        <p className="dash-muted" style={{ fontSize: 12, marginTop: 6 }}>
          {status === "error" ? "Captcha failed to load." : "Loading captcha…"}
        </p>
      )}
    </div>
  );
};

export default ReCaptchaBox;
