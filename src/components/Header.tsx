// src/components/Header.tsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import type { User } from "../types";
import { Balance } from "./Balance";
import "../pages/styles/header.css";

interface HeaderProps {
  user: User | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    const current = location.pathname;
    if (path === "/home" || path === "/") {
      return current === "/home" || current === "/";
    }
    return current === path;
  };

  const balance = typeof user?.balance === "number" ? user.balance : 0;

  return (
    <>
      {/* --------------------------------------------------
          DESKTOP GLASS HEADER
      -------------------------------------------------- */}
      <header className="rb-desktop-header desktop-only">
        <div className="rb-desktop-wrap">
          {/* LOGO */}
          <Link to="/home" className="rb-logo">
            🥖 ReadyBread
          </Link>

          {/* NAVIGATION */}
          <nav className="rb-desktop-nav">
            <Link to="/home" className={isActive("/home") ? "active" : ""}>
              Home
            </Link>

            {user && (
              <>
                <Link to="/earn" className={isActive("/earn") ? "active" : ""}>
                  Earn
                </Link>
                <Link
                  to="/dashboard"
                  className={isActive("/dashboard") ? "active" : ""}
                >
                  Dashboard
                </Link>
                <Link
                  to="/rewards"
                  className={isActive("/rewards") ? "active" : ""}
                >
                  Rewards
                </Link>
                <Link to="/quests" className={isActive("/quests") ? "active" : ""}>
                  Quests
                </Link>
              </>
            )}

            {!user && (
              <Link to="/login" className={isActive("/login") ? "active" : ""}>
                Login
              </Link>
            )}

            <Link
              to="/tutorials"
              className={isActive("/tutorials") ? "active" : ""}
            >
              Help
            </Link>

            <Link to="/articles" className={isActive("/articles") ? "active" : ""}>
              Articles
            </Link>
          </nav>

          {/* RIGHT SIDE */}
          <div className="rb-desktop-right">
            {user ? (
              <Balance balance={balance} user={user} />
            ) : (
              <Link to="/login" className="rb-login-btn">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------
          MOBILE TOP BALANCE STRIP
      -------------------------------------------------- */}
      {user && (
        <div className="rb-mobile-balance mobile-only">
          {user && (
            <Link
              to="/quests"
              className={`mobile-quests-btn ${isActive("/quests") ? "active" : ""}`}
            >
              <img
                src={
                  isActive("/quests")
                    ? "/icons/medal-color.png"
                    : "/icons/medal-white.png"
                }
                alt="Quests"
              />
            </Link>
          )}

          {/* Top Title */}
          <div className="rb-mobile-title">ReadyBread</div>

          {/* Balance + streak */}
          <Balance balance={balance} user={user} />
        </div>
      )}

      {/* --------------------------------------------------
          MOBILE BOTTOM NAV
      -------------------------------------------------- */}
      <nav className="rb-mobile-nav mobile-only">
        <div className="nav-inner">
          {/* HOME */}
          <Link
            to="/home"
            className={`nav-item ${isActive("/home") ? "active" : ""}`}
          >
            <img
              src={
                isActive("/home")
                  ? "/icons/home-color.png"
                  : "/icons/home-white.png"
              }
              className="nav-icon"
              alt="Home"
            />
            <span className={`nav-label ${isActive("/home") ? "active" : ""}`}>
              Home
            </span>
          </Link>

          {/* REWARDS */}
          {user && (
            <Link
              to="/rewards"
              className={`nav-item ${isActive("/rewards") ? "active" : ""}`}
            >
              <img
                src={
                  isActive("/rewards")
                    ? "/icons/cashout-color.png"
                    : "/icons/cashout-white.png"
                }
                className="nav-icon"
                alt="Rewards"
              />
              <span className={`nav-label ${isActive("/rewards") ? "active" : ""}`}>
                Rewards
              </span>
            </Link>
          )}

          {/* EARN */}
          {user && (
            <Link
              to="/earn"
              className={`nav-item ${isActive("/earn") ? "active" : ""}`}
            >
              <img
                src={
                  isActive("/earn")
                    ? "/icons/earnings-color.png"
                    : "/icons/earnings-white.png"
                }
                className="nav-icon"
                alt="Earn"
              />
              <span className={`nav-label ${isActive("/earn") ? "active" : ""}`}>
                Earn
              </span>
            </Link>
          )}

          {/* HELP */}
          <Link
            to="/tutorials"
            className={`nav-item ${isActive("/tutorials") ? "active" : ""}`}
          >
            <img
              src={
                isActive("/tutorials")
                  ? "/icons/help-color.png"
                  : "/icons/help-white.png"
              }
              className="nav-icon"
              alt="Help"
            />
            <span className={`nav-label ${isActive("/tutorials") ? "active" : ""}`}>
              Help
            </span>
          </Link>

          {/* DASHBOARD */}
          {user && (
            <Link
              to="/dashboard"
              className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}
            >
              <img
                src={
                  isActive("/dashboard")
                    ? "/icons/dash-color.png"
                    : "/icons/dash-white.png"
                }
                className="nav-icon"
                alt="Dashboard"
              />
              <span className={`nav-label ${isActive("/dashboard") ? "active" : ""}`}>
                Dashboard
              </span>
            </Link>
          )}

          {/* LOGIN — logged out only */}
          {!user && (
            <Link to="/login" className="nav-item">
              <img
                src={
                  isActive("/login")
                    ? "/icons/user-color.png"
                    : "/icons/user-white.png"
                }
                className="nav-icon"
                alt="Login"
              />
              <span className="nav-label">Login</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
};
