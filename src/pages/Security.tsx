// src/pages/Affiliate.tsx
import React from "react";

interface Security {
  id: string;
  title: string;
  emoji: string;
  description: string;
  link: string;
  banner?: string;
  colorClass?: string; // optional color theme (surveys-card, games-card, etc.)
}

export const Security: React.FC = () => {
  // All affiliates stored in one list (EASY to add/remove)
    const affiliates = [
    {
        id: "empty",
        title: "More coming soon!",
        emoji: "⏳",
        description: "This feature is currently halfbaked. Come back later!",
        link: "",
        logo: "",
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
