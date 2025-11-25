import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";
import { useUser } from "../contexts/UserContext";
import { isStandaloneMode } from "../utils/pwa";

interface ShortcutBonusResponse {
  ok?: boolean;
  amount?: number;
}

export function useShortcutBonus(autoTrigger = true) {
  const { user, profile } = useUser();

  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState<number | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  const alreadyClaimed = profile?.shortcutBonusClaimed === true;
  const isStandalone = isStandaloneMode();

  useEffect(() => {
    setHasAttempted(false);
    setClaimedAmount(null);
    setError(null);
  }, [user?.uid]);

  const triggerClaim = useCallback(async () => {
    if (!user) return null;

    try {
      setClaiming(true);
      setError(null);

      const callable = httpsCallable(functions, "claimShortcutBonus");
      const res = await callable({});
      const data = res.data as ShortcutBonusResponse;

      const amount =
        typeof data?.amount === "number" ? data.amount : claimedAmount;
      setClaimedAmount(amount ?? null);

      return data;
    } catch (err: any) {
      const message =
        err?.message ||
        err?.code ||
        "Shortcut bonus failed. Please try opening from your home screen again.";
      setError(message);
      return null;
    } finally {
      setClaiming(false);
    }
  }, [claimedAmount, user]);

  useEffect(() => {
    if (!autoTrigger) return;
    if (!user || !profile) return;
    if (!isStandalone) return;
    if (alreadyClaimed) return;
    if (hasAttempted || claiming) return;

    setHasAttempted(true);
    void triggerClaim();
  }, [
    autoTrigger,
    user,
    profile,
    isStandalone,
    alreadyClaimed,
    hasAttempted,
    claiming,
    triggerClaim,
  ]);

  return {
    isStandalone,
    alreadyClaimed,
    claimedAmount,
    claiming,
    error,
    triggerClaim,
  };
}
