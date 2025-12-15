// src/pages/Affiliate.tsx
import React from "react";
import bisectLogo from "../static/images/affiliates/bisect.png";
import g2aLogo from "../static/images/affiliates/g2a.webp";

interface Affiliate {
  id: string;
  title: string;
  emoji: string;
  description: string;
  link: string;
  banner?: string;
  colorClass?: string; // optional color theme (surveys-card, games-card, etc.)
}

export const Affiliate: React.FC = () => {
  // All affiliates stored in one list (EASY to add/remove)
    const affiliates = [
    {
        id: "bisect",
        title: "BisectHosting",
        emoji: "🖥️",
        description: "Host a gaming server with bisect hosting, and get 25% with code \"BOX\"",
        link: "https://www.bisecthosting.com/partners/custom-banner/whatever",
        logo: bisectLogo,
        colorClass: "surveys-card"
    },
    {
        id: "g2a",
        title: "G2A",
        emoji: "🔑",
        description: "Low-cost random (and selected) steam keys, starting at as little as just $1.",
        link: "https://www.g2a.com/r/readybread",
        logo: g2aLogo,
        colorClass: "games-card"
    }
    ];

    // Add new affiliates by pushing more objects:
    //
    // {
    //   id: "example",
    //   title: "Example Partner",
    //   emoji: "🔥",
    //   description: "Cool description.",
    //   link: "https://example.com",
    //   banner: "optional_banner_url",
    //   colorClass: "surveys-card"
    // },

  return (
    <main className="rb-content theme-games">
        <h2 className="modern-title">
        Affiliate Partners
        </h2>
        <p className="modern-subtitle">Support ReadyBread & score exclusive deals.</p>

        <div className="modern-grid">
            {affiliates.map((aff) => (
                <a
                href={aff.link}
                key={aff.id}
                className={`modern-card affiliate-card ${aff.colorClass || ""}`}
                target="_blank"
                rel="noopener noreferrer"
                >
                {/* Icon */}
                <div className="modern-icon">
                    <span className="emoji">{aff.emoji}</span>
                </div>

                {/* Title */}
                <div className="modern-title-sm">{aff.title}</div>

                {/* Desc */}
                <div className="modern-desc">{aff.description}</div>

                {/* NEW - 32px logo badge */}
                {aff.logo && (
                    <div className="affiliate-logo-badge">
                    <img src={aff.logo} alt={`${aff.title} logo`} />
                    </div>
                )}
                </a>
            ))}
        </div>
    </main>
  );
};
