// src/pages/Games.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type User } from "../types";
import { db } from "../config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

interface GamesProps {
  user: User | null;
}

interface Offer {
  id: string;
  title: string;
  payout: number;
  image_url: string | null;
  click_url: string;
  est_minutes: number | null;
  disclaimer?: string | null;
  objectives?: Array<{
    name: string;
    reward: number;
  }>;
}

export const Games: React.FC<GamesProps> = ({ user }) => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const BITLABS_KEY = "250f0833-3a86-4232-ae29-9b30026d1820";

  useEffect(() => {
    if (!user) {
      alert("Please log in to view game offers.");
      navigate("/login");
      return;
    }
    loadOffers();
  }, [user, navigate]);

  const loadOffers = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("https://api.bitlabs.ai/v2/client/offers", {
        headers: {
          "X-Api-Token": BITLABS_KEY,
          "X-User-Id": user.uid,
          "X-Api-Sdk": "CUSTOM",
        },
      });

      if (!res.ok) {
        console.error("BitLabs offers HTTP error", res.status, res.statusText);
        setError("Failed to load offers. Please try again later.");
        setOffers([]);
        return;
      }

      const json = await res.json();
      const rawOffers = (json?.data?.offers || []) as any[];

      const mapped: Offer[] = rawOffers.map((o) => {
        const payout =
          typeof o.payout === "number"
            ? o.payout
            : parseFloat(o.points ?? o.reward ?? 0) / 100;

        return {
          id: String(o.id ?? o.anchor ?? o.offer_id),
          title: String(o.title ?? o.anchor ?? "Game offer"),
          payout: isNaN(payout) ? 0 : payout,
          image_url:
            o.image_url ??
            o.icon_url ??
            o.app_metadata?.screenshot_urls?.[0] ??
            null,
          click_url: o.click_url ?? o.continue_url ?? "#",
          est_minutes:
            typeof o.est_minutes === "number"
              ? o.est_minutes
              : o.hours_left
              ? o.hours_left * 60
              : null,
          disclaimer: o.disclaimer ?? null,
          // If you later map BitLabs milestones, pipe them into objectives
          objectives: undefined,
        };
      });

      setOffers(mapped);
    } catch (err) {
      console.error("Error loading offers:", err);
      setError("Something went wrong while loading offers.");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleMoreInfo = (offerId: string) => {
    setExpandedOfferId((prev) =>
      prev === offerId ? null : offerId
    );
  };

  const handleStartOffer = async (offer: Offer) => {
    if (!user) {
      alert("Please log in to start an offer.");
      navigate("/login");
      return;
    }

    try {
      const totalObjectives = offer.objectives?.length ?? 0;

      await setDoc(
        doc(db, "users", user.uid, "startedOffers", offer.id),
        {
          offerId: offer.id,
          title: offer.title,
          totalPayout: offer.payout,
          estMinutes: offer.est_minutes ?? null,
          imageUrl: offer.image_url ?? null,
          clickUrl: offer.click_url,
          source: "bitlabs-offers",
          status: "started", // later: "in-progress" or "completed"
          startedAt: serverTimestamp(),
          lastUpdatedAt: serverTimestamp(),
          // Progress fields for the dashboard
          totalObjectives,
          completedObjectives: 0,
          type: "game",
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to log started offer:", err);
    }

    if (offer.click_url && offer.click_url !== "#") {
      window.open(offer.click_url, "_blank");
    } else {
      alert("Offer link is currently unavailable.");
    }
  };

  return (
    <main className="rb-content theme-games">
      <section className="earn-shell">
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">
              <span className="emoji">🎮</span> Game &amp; App Offers
            </h2>
            <p className="rb-section-sub">
              Install and play games to earn <i>big</i>.
            </p>

            {/* subtle glass stats / “powered by” row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "10px",
                fontSize: "13px",
                opacity: 0.9,
              }}
            >
              <span className="chip chip-time">
                {offers.length > 0
                  ? `${offers.length} live offers`
                  : loading
                  ? "Checking offers…"
                  : "No active offers at the moment"}
              </span>
            </div>
          </div>
        </div>

        {loading && <div className="survey-empty">Loading offers…</div>}

        {!loading && error && <div className="survey-empty">{error}</div>}

        {!loading && !error && offers.length === 0 && (
          <div className="survey-empty">
            No offers available right now. Try again later.
          </div>
        )}

        {!loading && !error && offers.length > 0 && (
          <div className="survey-list">
            {offers.map((offer) => {
              const isExpanded = expandedOfferId === offer.id;

              return (
                <div
                  key={offer.id}
                  className="survey-card rb-card modern-card"
                >
                  <div className="offer-main">
                    <div className="offer-header-row">
                      <div className="offer-thumb">
                        <div className="offer-thumb-inner">
                          {offer.image_url ? (
                            <img src={offer.image_url} alt={offer.title} />
                          ) : (
                            <span className="rb-emoji">🎮</span>
                          )}
                        </div>
                      </div>

                      <div className="offer-copy">
                        <h3 className="glow-soft">{offer.title}</h3>
                        <p className="offer-tags">
                          <span className="chip chip-payout">
                            ${offer.payout.toFixed(2)} total
                          </span>
                          <span className="chip chip-time">
                            ~{offer.est_minutes || "?"} min
                          </span>
                        </p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="offer-details">
                        <h4>How this offer works</h4>

                        {offer.objectives && offer.objectives.length > 0 ? (
                          <ul className="offer-objectives">
                            {offer.objectives.map((obj, idx) => (
                              <li key={idx}>
                                <span className="obj-name">{obj.name}</span>
                                <span className="obj-reward">
                                  +${obj.reward.toFixed(2)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="offer-details-copy">
                            This partner pays after you complete all in-app
                            goals for the offer. You&apos;ll receive the full{" "}
                            <b>${offer.payout.toFixed(2)}</b> once BitLabs
                            confirms completion.
                          </p>
                        )}

                        {offer.disclaimer && (
                          <p className="offer-disclaimer">
                            {offer.disclaimer}
                          </p>
                        )}

                        <p className="offer-details-note">
                          Tip: Make sure to open the offer from ReadyBread and
                          keep it installed until your reward is credited.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="survey-actions offer-actions">
                    <button
                      type="button"
                      className="survey-more-btn"
                      onClick={() => toggleMoreInfo(offer.id)}
                    >
                      {isExpanded ? "Hide info" : "More info"}
                    </button>

                    <button
                      type="button"
                      className="survey-start-btn"
                      onClick={() => handleStartOffer(offer)}
                    >
                      Start Offer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
