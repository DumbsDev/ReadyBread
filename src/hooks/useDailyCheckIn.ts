// src/hooks/useDailyCheckIn.ts
import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { db } from "../config/firebase";

export interface DailyCheckInResult {
  updated: boolean;
  reset: boolean;
  dailyStreak: number;
  bonusPercent: number;
  lastCheckIn: number; // millis
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CHECKIN_COOLDOWN_MS = ONE_DAY_MS * 0.75; // matches callable window

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  return null;
}

export function useDailyCheckIn() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DailyCheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  // Preload last check-in data so we know whether to show the popup
  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      if (!user) {
        setResult(null);
        setShow(false);
        return;
      }

      try {
        setError(null);

        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) {
          if (!cancelled) {
            // No streak data yet; let the UI prompt a first check-in.
            setResult(null);
            setShow(true);
          }
          return;
        }

        const data = snap.data() || {};
        const dailyStreak =
          typeof data.dailyStreak === "number" ? data.dailyStreak : 0;
        const bonusPercent =
          typeof data.bonusPercent === "number" ? data.bonusPercent : 0;
        const lastCheckIn = toMillis(data.lastCheckIn);

        const hydrated: DailyCheckInResult = {
          updated: false,
          reset: false,
          dailyStreak,
          bonusPercent,
          lastCheckIn: lastCheckIn ?? 0,
        };

        const diff = lastCheckIn ? Date.now() - lastCheckIn : Infinity;
        const canShow = !lastCheckIn || diff >= CHECKIN_COOLDOWN_MS;

        if (!cancelled) {
          setResult(hydrated);
          setShow(canShow);
        }
      } catch (err: any) {
        console.error("Failed to load check-in status:", err);
        if (!cancelled) {
          setError(err?.message || "Unknown error");
        }
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const hidePopup = () => setShow(false);

  const runCheckIn = async (): Promise<DailyCheckInResult | null> => {
    if (!user) return null;

    try {
      setLoading(true);
      setError(null);

      const functions = getFunctions();
      const checkIn = httpsCallable(functions, "dailyCheckIn");

      const response = await checkIn({});
      const data = response.data as DailyCheckInResult;

      setResult(data);
      setShow(false); // hide after a successful (or already-run) check-in
      return data;
    } catch (err: any) {
      console.error("Check-in failed:", err);
      setError(err?.message || "Unknown error");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    result,
    data: result,
    show,
    runCheckIn,
    hidePopup,
  };
}
