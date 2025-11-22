// src/components/ChangelogCard.tsx
import React from "react";
import { useChangelog } from "../hooks/useChangelog";

export const ChangelogCard: React.FC = () => {
  const { entry, loading } = useChangelog();

  return (
    <div className="rb-card" style={{ marginBottom: "22px" }}>
      <h3 className="rb-section-title" style={{ fontSize: "1.4rem" }}>
        🔄 Latest Update
      </h3>

      {loading && (
        <p className="dash-muted" style={{ marginTop: "6px" }}>
          Fetching latest changelog…
        </p>
      )}

      {!loading && entry && (
        <>
        <h4
            style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            marginBottom: "6px",
            color: "var(--soft-sugar)",
            }}
        >
            {entry.title}
        </h4>
            <section className="changelog">
            <p
                style={{
                whiteSpace: "pre-wrap",
                lineHeight: "1.45",
                opacity: 0.92,
                marginBottom: "14px",
                }}
            >
                {entry.body}
            </p>
        </section>

          {/* 🔗 GitHub Link Button */}
          <button
            onClick={() =>
              window.open(
                "https://github.com/DumbsDev/ReadyBread-Changelog",
                "_blank"
              )
            }
            style={{
              marginTop: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 204, 120, 0.35)",
              background: "rgba(255, 204, 120, 0.08)",
              color: "var(--soft-sugar)",
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.18s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              filter: "drop-shadow(0 0 4px rgba(255,191,90,0.3))",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                "0 0 8px rgba(255,191,90,0.6)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "none";
            }}
          >
            🔗 View on GitHub
          </button>
        </>
      )}

      {!loading && !entry && (
        <p className="dash-muted">Unable to load changelog.</p>
      )}
    </div>
  );
};
