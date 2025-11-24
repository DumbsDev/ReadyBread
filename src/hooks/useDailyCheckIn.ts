// src/hooks/useDailyCheckIn.ts
import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../config/firebase";

interface DailyCheckInResult {
  updated: boolean;
  reset: boolean;
  dailyStreak: number;
  bonusPercent: number;
  lastCheckIn: number;
}

export function useDailyCheckIn() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DailyCheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheckIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const functions = getFunctions(app);
      const callable = httpsCallable<unknown, DailyCheckInResult>(
        functions,
        "dailyCheckIn"
      );
      const res = await callable();
      const data = res.data;

      setResult(data);
      return data;
    } catch (err: any) {
      console.error("dailyCheckIn error:", err);
      setError(err?.message || "Check-in failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { runCheckIn, loading, result, error };
}
