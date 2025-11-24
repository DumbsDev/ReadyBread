// src/components/DailyCheckInModal.tsx
import React from "react";
import "../home.css";

interface DailyCheckInModalProps {
  open: boolean;
  onClose: () => void;
  onCheckIn: () => Promise<void>;
  loading: boolean;
  dailyStreak?: number;
  bonusPercent?: number;
}

function getStreakEmoji(streak?: number): string {
  if (!streak || streak <= 0) return "❄️";
  if (streak <= 3) return `❄️`;
  if (streak <= 7) return `☁️`;
  return `🔥`;
}

export const DailyCheckInModal: React.FC<DailyCheckInModalProps> = ({
  open,
  onClose,
  onCheckIn,
  loading,
  dailyStreak,
  bonusPercent,
}) => {
  if (!open) return null;

  const emoji = getStreakEmoji(dailyStreak);
  const streakText =
    typeof dailyStreak === "number" && dailyStreak > 0
      ? `${dailyStreak} day${dailyStreak > 1 ? "s" : ""}`
      : "new streak";

  const bonusText =
    typeof bonusPercent === "number"
      ? `+${bonusPercent.toFixed(1)}% earnings boost`
      : "+0.0% earnings boost";

  return (
    <div className="checkin-backdrop">
      <div className="checkin-modal">
        <h2 className="checkin-title">
          Welcome back, Breadwinner! {emoji}
        </h2>
        <p className="checkin-sub">
          You&apos;re on a <b>{streakText}</b> streak.
          <br />
          Your current bonus is <b>{bonusText}</b>.
        </p>

        <p className="checkin-note">
          Checking in daily slowly increases your bonus up to{" "}
          <b>+10%</b> on all offers you complete (surveys, games, receipts).
        </p>

        <div className="checkin-actions">
          <button
            className="checkin-btn-primary"
            onClick={onCheckIn}
            disabled={loading}
          >
            {loading ? "Checking in..." : "Check in for today"}
          </button>
          <button className="checkin-btn-secondary" onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};
