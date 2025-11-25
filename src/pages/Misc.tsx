// src/pages/Misc.tsx
import React from "react";
import { Link } from "react-router-dom";

export const Misc: React.FC = () => {
  return (
    <main className="rb-content theme-games">
      <h2 className="modern-title">
        <span className="emoji">✨</span> More Ways to Earn
      </h2>
      <p className="modern-subtitle">
        Extra tools & earning opportunities, baked fresh for you.
      </p>

      <div className="modern-grid">
        {/* Offer Walls Hub */}
        <Link to="/offerwalls" className="modern-card surveys-card">
          <div className="modern-icon">
            <span className="emoji">🧱</span>
          </div>
          <div className="modern-title-sm">Offer Walls Hub</div>
          <div className="modern-desc">
            Earn by brand, instead of method.
          </div>
        </Link>

        {/* Affiliate Program */}
        <Link to="/affiliate" className="modern-card misc-card">
          <div className="modern-icon">
            <span className="emoji">🤝</span>
          </div>
          <div className="modern-title-sm">Save on gaming, servers, and more.</div>
          <div className="modern-desc">
            Get discounts, cashback, and shop credit on games, servers, and subscriptions you love.
          </div>
        </Link>

        {/* Security / privacy deals */}
        <Link to="/Security" className="modern-card surveys-card">
          <div className="modern-icon">
            <span className="emoji">🛡️</span>
          </div>
          <div className="modern-title-sm">Save on security, VPNs, and more.</div>
          <div className="modern-desc">Get discounts, free trials, and more on your security.</div>
        </Link>

        {/* Coming Soon */}
        <div className="modern-card games-card">
          <div className="modern-icon">
            <span className="emoji">⏳</span>
          </div>
          <div className="modern-title-sm">More Coming Soon!</div>
          <div className="modern-desc">
            New earning features are in the oven, stay tuned ;)
          </div>
        </div>
      </div>
    </main>
  );
};
