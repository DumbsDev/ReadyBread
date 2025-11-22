// src/components/Balance.tsx
// Animated balance display with rolling digits and glow on change

import React, { useEffect, useRef, useState } from "react";

interface BalanceProps {
  balance: number; // Balance in USD (e.g., 12.34)
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

export const Balance: React.FC<BalanceProps> = ({ balance }) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const previous = useRef<number | null>(null);

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

  // Keep previous updated even on first render
  useEffect(() => {
    previous.current = balance;
  }, [balance]);

  const formatted = balance.toFixed(2); // always keep two decimals
  const chars = formatted.split("");

  return (
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
  );
};
