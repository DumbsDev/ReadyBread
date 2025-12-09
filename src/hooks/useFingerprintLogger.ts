import { useEffect, useRef } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../config/firebase";
import { useUser } from "../contexts/UserContext";
import { getDeviceId } from "../utils/device";
import { getClientIp } from "../utils/ip";

export const useFingerprintLogger = () => {
  const { authUser } = useUser();
  const lastUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authUser) return;
    if (lastUidRef.current === authUser.uid) return;
    lastUidRef.current = authUser.uid;

    const run = async () => {
      const deviceId = getDeviceId();
      let ip = "";
      try {
        ip = await getClientIp();
      } catch {
        ip = "";
      }

      try {
        const fn = httpsCallable(
          getFunctions(app, "us-central1"),
          "logUserFingerprint"
        );
        await fn({
          deviceId,
          ip,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          source: "app",
        });
      } catch (err) {
        console.error("logUserFingerprint failed:", err);
      }
    };

    run();
  }, [authUser?.uid]);
};
