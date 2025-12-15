// src/components/Header.tsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { User } from "../types";
import { Balance } from "./Balance";
import "../pages/styles/header.css";

interface HeaderProps {
  user: User | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    const current = location.pathname;
    if (path === "/home" || path === "/") {
      return current === "/home" || current === "/";
    }
    return current === path;
  };

  const balance = typeof user?.balance === "number" ? user.balance : 0;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const extraLinks = [
    { to: "/offerwalls", label: "Offer walls" },
    { to: "/offer-history", label: "Offer history" },
    { to: "/proof", label: "Payout proofs" },
    { to: "/anti-fraud", label: "Anti-fraud" },
    {
      to: "/partner",
      label: "Partner dashboard",
      show:
        user?.admin ||
        (user as any)?.partner === true ||
        (user as any)?.partnerSources?.length > 0,
    },
    { to: "/admin", label: "Admin", show: user?.admin },
  ].filter((l) => l.show !== false);

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

            {(user?.admin ||
              (user as any)?.partner === true ||
              (user as any)?.partnerSources?.length) && (
              <Link to="/partner" className={isActive("/partner") ? "active" : ""}>
                Partner
              </Link>
            )}
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
                    ? "/icons/medal-color.webp"
                    : "/icons/medal-white.webp"
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
                    ? "/icons/home-color.webp"
                    : "/icons/home-white.webp"
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
                    ? "/icons/cashout-color.webp"
                    : "/icons/cashout-white.webp"
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
                    ? "/icons/earnings-color.webp"
                    : "/icons/earnings-white.webp"
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
                    ? "/icons/help-color.webp"
                    : "/icons/help-white.webp"
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
                    ? "/icons/dash-color.webp"
                    : "/icons/dash-white.webp"
                }
                className="nav-icon"
                alt="Dashboard"
              />
              <span className={`nav-label ${isActive("/dashboard") ? "active" : ""}`}>
                Dashboard
              </span>
            </Link>
          )}

          <button
            type="button"
            className={`nav-item nav-more ${mobileMenuOpen ? "active" : ""}`}
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-label="Open more navigation"
        >
          <div className="nav-icon nav-more-icon">|||</div>
          <span className={`nav-label ${mobileMenuOpen ? "active" : ""}`}>
            More
          </span>
        </button>

          {/* LOGIN — logged out only */}
          {!user && (
            <Link to="/login" className="nav-item">
              <img
                src={
                  isActive("/login")
                    ? "/icons/user-color.webp"
                    : "/icons/user-white.webp"
                }
                className="nav-icon"
                alt="Login"
              />
              <span className="nav-label">Login</span>
            </Link>
          )}
        </div>
      </nav>

      <div className={`mobile-drawer ${mobileMenuOpen ? "open" : ""}`}>
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div className="mobile-drawer-panel">
          <h4>Quick links</h4>
          <div className="drawer-grid">
            {extraLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="drawer-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
