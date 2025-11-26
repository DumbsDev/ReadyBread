import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { UserProvider } from "./contexts/UserContext";

// Clear the CSS bust flag after a successful boot so future deploys can trigger it again if needed.
sessionStorage.removeItem("rb-css-bust-v1");

// Only register the service worker in production and outside localhost to avoid
// dev/preview cache issues that can break asset loading.
if ("serviceWorker" in navigator) {
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname
  );

  if (import.meta.env.PROD && !isLocalhost) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) =>
          console.error("Service worker registration failed:", err)
        );
    });
  } else {
    // In dev/preview, remove any existing SW so it cannot hijack requests.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister().catch(() => undefined));
    });
  }
}

const container = document.getElementById("root");
if (!container) throw new Error("Root #root not found");

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>
);
