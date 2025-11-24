// src/components/Balance.tsx
// Animated balance display + daily streak indicator + bonus percent

import React, { useEffect, useRef, useState } from "react";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";

interface BalanceProps {
  balance: number; // USD balance
  user?: any;      // user object (uid needed)
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const RollingDigit: React.FC<{ value: number }> = ({ value }) => {
  const safeValue = Number.isFinite(value) ? value : 0;

  return (
    <span className="rb-digit-roller">
      <span
        className="rb-digit-track"
        style={{ ["--digit-value" as never]: safeValue }}
        aria-hidden="true"
      >
        {DIGITS.map((d) => (
          <span key={d} className="rb-digit">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
};

export const Balance: React.FC<BalanceProps> = ({ balance, user }) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const previous = useRef<number | null>(null);

  // ---------- DAILY STREAK ----------
  const [streak, setStreak] = useState<number>(0);
  const [bonusPercent, setBonusPercent] = useState<number>(0);
  const [streakIcon, setStreakIcon] = useState<string>("❄️");

  useEffect(() => {
    if (!user?.uid) return;

    const loadStreak = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) return;

        const data = snap.data();
        const s = data.dailyStreak ?? 0;
        const bonus = data.bonusPercent ?? 0;

        setStreak(s);
        setBonusPercent(bonus);

        // 🧊 1–3 days
        if (s >= 1 && s <= 3) setStreakIcon("❄️");
        // ☁️ 4–7 days
        else if (s >= 4 && s <= 7) setStreakIcon("☁️");
        // 🔥 8+ days
        else if (s >= 8) setStreakIcon("🔥");
      } catch (err) {
        console.error("Error loading streak:", err);
      }
    };

    loadStreak();
  }, [user]);

  // ---------- ORIGINAL PULSE ANIMATION ----------
  useEffect(() => {
    const hasChanged =
      previous.current !== null && Math.abs(balance - previous.current) > 0.0001;

    if (hasChanged) {
      setIsPulsing(false);
      const raf = requestAnimationFrame(() => setIsPulsing(true));
      const timeout = setTimeout(() => setIsPulsing(false), 900);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timeout);
      };
    }

    previous.current = balance;
  }, [balance]);

  useEffect(() => {
    previous.current = balance;
  }, [balance]);

  // ---------- FORMATTED BALANCE ----------
  const formatted = balance.toFixed(2);
  const chars = formatted.split("");

  return (
    <div className={`rb-balance-wrapper`}>
      {/* BALANCE */}
      <div
        className={`rb-balance ${isPulsing ? "rb-balance-pulse" : ""}`}
        aria-label={`Balance $${formatted}`}
        role="text"
      >
        <div className="rb-balance-inner">
          <span className="rb-balance-prefix">$</span>

          <div className="rb-balance-digits">
            {chars.map((char, idx) => {
              if (char === ".") {
                return (
                  <span key={`dot-${idx}`} className="rb-digit-static">
                    .
                  </span>
                );
              }

              const num = Number(char);
              if (Number.isNaN(num)) {
                return (
                  <span key={`static-${idx}`} className="rb-digit-static">
                    {char}
                  </span>
                );
              }

              return <RollingDigit key={`digit-${idx}`} value={num} />;
            })}
          </div>
        </div>
      </div>

      {/* DAILY STREAK DISPLAY */}
      {streak > 0 && (
        <div className="rb-streak-chip" title="Daily streak bonus">
          <span className="streak-icon">{streakIcon}</span>
          <span className="streak-count">{streak}d</span>
          <span className="streak-bonus">+{bonusPercent.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};
