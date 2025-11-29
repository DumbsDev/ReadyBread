// src/components/Balance.tsx
// Animated balance display + optional streak chip

import React, { useEffect, useRef, useState } from "react";
import "../home.css";
import "../styles.css";

interface BalanceProps {
  balance: number;
  user?: any;
  showStreak?: boolean; // NEW FLAG
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const getStreakEmoji = (value: number) => {
  if (value >= 7) return "\uD83D\uDD25"; // fire
  if (value >= 4) return "\u2601\uFE0F"; // cloud
  return "\u2744\uFE0F"; // snow
};

const getStreakVariant = (value: number) => {
  if (value >= 7) return "fire";
  if (value >= 4) return "cloud";
  return "snow";
};

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

export const Balance: React.FC<BalanceProps> = ({
  balance,
  user,
  showStreak = true, // default ON for headers
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const previous = useRef<number | null>(null);

  // ---------- STREAK ----------
  const streakFromUser =
    typeof user?.dailyStreak === "number"
      ? user.dailyStreak
      : typeof user?.profile?.dailyStreak === "number"
      ? user.profile.dailyStreak
      : 0;

  const streak = Math.max(0, streakFromUser);
  const streakIcon = getStreakEmoji(streak);
  const streakVariant = getStreakVariant(streak);

  // ---------- PULSE ANIMATION ----------
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

  const formatted = balance.toFixed(2);
  const chars = formatted.split("");

  return (
    <div className="rb-balance-wrapper fc-layout">
      {/* LEFT-SIDE STREAK BOX — only if showStreak===true */}
      {showStreak && (
        <div
          className={`fc-streak-box fc-streak--${streakVariant}`}
          aria-label={`Current streak ${streak} day${streak === 1 ? "" : "s"}`}
        >
          <span className="fc-streak-emoji">{streakIcon}</span>
          <span className="fc-streak-days">{streak}</span>
        </div>
      )}

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
    </div>
  );
};
