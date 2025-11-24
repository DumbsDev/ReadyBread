// src/components/DailyCheckInModal.tsx
import React from "react";
import "../home.css";

interface DailyCheckInModalProps {
  open: boolean;
  onCheckIn: () => Promise<void>;
  onClose?: () => void;
  loading: boolean;
  dailyStreak?: number;
  bonusPercent?: number;
}

function getStreakEmoji(streak?: number): string {
  if (!streak || streak <= 0) return "❄️";
  if (streak <= 3) return "❄️";
  if (streak <= 7) return "☁️";
  return "🔥";
}

export const DailyCheckInModal: React.FC<DailyCheckInModalProps> = ({
  open,
  onCheckIn,
  onClose,
  loading,
  dailyStreak,
  bonusPercent,
}) => {
  if (!open) return null;

  const handleOverlayClick = () => {
    if (loading) return;
    onClose?.();
  };

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

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
    <div className="checkin-alert-overlay" onClick={handleOverlayClick}>
      <div className="checkin-alert-modal" onClick={stopPropagation}>
        <h2 className="checkin-alert-title">
          Welcome back! {emoji}
        </h2>

        <p className="checkin-alert-body">
          You're on a <b>{streakText}</b> streak.  
          <br />
          Your bonus is now <b>{bonusText}</b>.
        </p>

        <p className="checkin-alert-small">
          Check in daily to build up to a <b>+10%</b> boost on all earnings.
        </p>

        <button
          className="checkin-alert-btn"
          onClick={onCheckIn}
          disabled={loading}
        >
          {loading ? "Checking in…" : "OK"}
        </button>

        {onClose && (
          <button
            className="checkin-alert-btn"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Maybe later
          </button>
        )}
      </div>
    </div>
  );
};
