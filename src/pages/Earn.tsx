// src/pages/Earn.tsx
import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

export const Earn: React.FC = () => {
  const { user, loading } = useUser();
  const navigate = useNavigate();

  // Require login
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <main className="rb-content earn-modern">
        <p className="rb-section-sub" style={{ textAlign: "center" }}>
          Checking account...
        </p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="rb-content earn-modern">
      <h2 className="modern-title">Earn Bread Your Way</h2>
      <p className="modern-subtitle">
        Pick a path and earn real cash (You can choose any path at any time)!
      </p>

      <div className="modern-grid">
        {/* Games FIRST (priority) */}
        <Link to="/games" className="modern-card games-card">
          <div className="modern-icon">
            <span className="emoji">🎮</span>
          </div>
          <div className="modern-title-sm">Game Offers</div>
          <div className="modern-desc">
            Hit milestones, level up, cash out. It's that easy.
          </div>
        </Link>

        {/* Surveys */}
        <Link to="/surveys" className="modern-card surveys-card">
          <div className="modern-icon">
            <span className="emoji">📋</span>
          </div>
          <div className="modern-title-sm">Surveys</div>
          <div className="modern-desc">Share your opinions and earn dough.</div>
        </Link>

        {/* Magic Receipts
        <Link to="/receipts" className="modern-card receipts-card">
          <div className="modern-icon">
            <span className="emoji">🧾</span>
          </div>
          <div className="modern-title-sm">Magic Receipts</div>
          <div className="modern-desc">
            Turn shopping receipts into bonus earnings.
          </div>
        </Link> */}

        {/* Misc Offers */}
        <Link to="/misc" className="modern-card misc-card">
          <div className="modern-icon">
            <span className="emoji">✨</span>
          </div>
          <div className="modern-title-sm">More Ways</div>
          <div className="modern-desc">
            Extra side quests, affiliate rewards, and ways to save.
          </div>
        </Link>
      </div>
    </main>
  );
};
