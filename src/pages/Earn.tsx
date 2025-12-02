// src/pages/Earn.tsx
import React, { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { computeLevelProgress, estimateBaseXp } from "../utils/level";
import "../earn.css";

type LaunchCard = {
  to: string;
  title: string;
  desc: string;
  badge: string;
  accent: "games" | "surveys" | "receipts";
};

type HubTile = {
  to: string;
  title: string;
  desc: string;
  badge: string;
  accent: "quests" | "misc" | "receipts";
};

export const Earn: React.FC = () => {
  const { user, profile, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <main className="earn-page">
        <p className="earn-loading">Checking account...</p>
      </main>
    );
  }

  if (!user || !profile) return null;

  const balance = Math.max(0, Number(profile.balance ?? user.balance ?? 0));
  const streak = profile.dailyStreak ?? 0;
  const bonusPercent = profile.bonusPercent ?? 0;
  const heroName = profile.username || user.email?.split("@")[0] || "Breadwinner";

  const levelState = useMemo(
    () =>
      computeLevelProgress(
        estimateBaseXp({
          balance,
          dailyStreak: streak,
        })
      ),
    [balance, streak]
  );

  const quickLaunches: LaunchCard[] = [
    {
      to: "/games",
      title: "Games",
      desc: "Milestone offers with the highest payouts.",
      badge: "Tap to play",
      accent: "games",
    },
    {
      to: "/surveys",
      title: "Surveys",
      desc: "Fresh surveys daily, earn that cash quick!",
      badge: "Tap to launch",
      accent: "surveys",
    },
    {
      to: "/receipts",
      title: "Magic Receipts",
      desc: "Scan those receipts and get that bread.",
      badge: "Tap to open",
      accent: "receipts",
    },
  ];

  const hubTiles: HubTile[] = [
    {
      to: "/quests",
      title: "Quests + XP",
      desc: "Daily and weekly goals that track while you earn.",
      badge: "Track",
      accent: "quests",
    },
    {
      to: "/offerwalls",
      title: "Offer walls",
      desc: "Pick a wall by provider for even more offers.",
      badge: "More offers",
      accent: "misc",
    },
    {
      to: "/receipts",
      title: "Magic receipts",
      desc: "Upload a shopping receipt for bonus cash.",
      badge: "Bonus",
      accent: "receipts",
    },
    {
      to: "/affiliate",
      title: "Affiliate boosts",
      desc: "Stack partner deals with your earning sessions.",
      badge: "Stackable",
      accent: "misc",
    },
  ];

  return (
    <main className="earn-page">
      <section className="earn-top-grid">
        <div className="earn-hero-block">
          <div className="pill-row">
            <span className="pill">Earnings hub</span>
            <span className="pill ghost">Live</span>
          </div>
          <h1>Jump into earning, {heroName}</h1>
          <p className="hero-sub">
            Bounce between games and surveys instantly. Every route still counts toward your streak,
            quest XP, and balance.
          </p>
          <div className="hero-stats">
            <div className="stat-chip">
              <span className="label">Streak bonus</span>
              <strong>+{bonusPercent.toFixed(1)}%</strong>
              <small>Auto-applied to offers</small>
            </div>
            <div className="stat-chip">
              <span className="label">Level preview</span>
              <strong>Lv {levelState.level}</strong>
              <div className="micro-progress">
                <span style={{ width: `${levelState.progressPct}%` }} />
              </div>
              <small>
                {levelState.currentXp} / {levelState.nextLevelXp} xp
              </small>
            </div>
          </div>
          <div className="earn-hero-actions">
            <Link className="earn-btn primary" to="/games">
              Launch games
            </Link>
            <Link className="earn-btn ghost" to="/surveys">
              Open surveys
            </Link>
            <Link className="hero-link" to="/quests">
              Track quests
            </Link>
          </div>
        </div>

        <div className="earn-quick-stack">
          <p className="pill ghost">Quick tap</p>
          <div className="fast-card-grid">
            {quickLaunches.map((item) => (
              <Link key={item.to} to={item.to} className={`fast-card ${item.accent}`}>
                <div className="fast-card-top">
                  <span className="fast-badge">{item.badge}</span>
                  <span className="fast-chevron">{">"}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <span className="fast-cta">Open {item.title}</span>
              </Link>
            ))}
          </div>

          <div className="fast-row">
            <Link className="fast-link" to="/quests">
              View quests
            </Link>
            <Link className="fast-link" to="/dashboard">
              Balance
            </Link>
            <Link className="fast-link" to="/tutorials">
              Tutorials
            </Link>
          </div>
        </div>
      </section>

      <section className="earn-quest-peek">
        <div className="peek-card">
          <div>
            <span className="pill">Quest preview</span>
            <h3>Keep your bonus running</h3>
            <p className="section-sub">
              Daily quest reset at midnight ET. Weekly reset Monday 12:00am ET. Earnings from games and
              surveys land here automatically.
            </p>

            <div className="peek-stats">
              <div className="peek-chip">
                <span className="label">Streak bonus</span>
                <strong>+{bonusPercent.toFixed(1)}%</strong>
                <small>Arrives on every payout</small>
              </div>
              <div className="peek-chip">
                <span className="label">Level</span>
                <strong>Lv {levelState.level}</strong>
                <small>{levelState.totalXp} xp total</small>
              </div>
              <div className="peek-chip">
                <span className="label">Quest shortcut</span>
                <strong>Quests</strong>
                <small>Claim when goals complete</small>
              </div>
            </div>
          </div>

          <div className="peek-actions">
            <Link className="earn-btn primary" to="/quests">
              Open quests
            </Link>
            <Link className="earn-btn ghost" to="/misc">
              More boosts
            </Link>
          </div>
        </div>
      </section>

      <section className="earn-grid-section">
        <div className="section-head">
          <div>
            <p className="pill ghost">More ways</p>
            <h2>Everything in one hub</h2>
            <p className="section-sub">
              Swap between offers, walls, and bonuses. You can return to games or surveys at any time.
            </p>
          </div>
          <Link className="section-link" to="/dashboard">
            View balance
          </Link>
        </div>

        <div className="earn-grid">
          {hubTiles.map((item) => (
            <Link key={item.to} to={item.to} className={`earn-tile accent-${item.accent}`}>
              <div className="earn-card-top">
                <span className="earn-badge">{item.badge}</span>
                <span className="earn-chevron">{">"}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <div className="earn-card-cta">Open {item.title}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="earn-secondary">
        <div className="secondary-card">
          <h3>Need a walkthrough?</h3>
          <p>
            Short tutorials cover the fastest routes through games, surveys, and offer walls so you do not
            lose your streak.
          </p>
          <div className="secondary-links">
            <Link className="secondary-link" to="/tutorials">
              Open tutorials
            </Link>
            <Link className="secondary-link" to="/quests">
              Check quests
            </Link>
          </div>
        </div>

        <div className="secondary-card ghost">
          <h3>Stay on streak</h3>
          <p>
            Switching between games and surveys is instant. Tap back anytime to keep the streak and bonus
            alive.
          </p>
          <div className="secondary-links">
            <Link className="secondary-link" to="/games">
              Launch games
            </Link>
            <Link className="secondary-link" to="/surveys">
              Open surveys
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};
