// src/pages/Games.tsx
// Game & App offers page, now using UserContext (ReadyBreadUser).
// BitLabs individual game offers + AdGem full-screen game wall card.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { AntiFraudGate } from "../components/AntiFraudGate";

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
  provider: "bitlabs" | "adgem";
  isWall?: boolean; // true for the AdGem wall hub card
}

// Toggle the AdGem offer wall button on/off for quick testing
const SHOW_ADGEM_WALL = false;

export const Games: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useUser();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter] = useState<"all" | "bitlabs" | "adgem">("all");
  const [sortMode, setSortMode] =
    useState<"recommended" | "highest" | "fastest">("recommended");

  const BITLABS_KEY = "250f0833-3a86-4232-ae29-9b30026d1820";

  // AdGem wall (HTML wall, not JSON API yet)
  const ADGEM_APP_ID = "31547";
  const ADGEM_WALL_BASE = "https://api.adgem.com/v1/wall";

  // Gate page behind auth
  useEffect(() => {
    if (loading) return;

    if (!user) {
      alert("Please log in to view game offers.");
      navigate("/login");
      return;
    }

    loadOffers(user);
  }, [user, loading, navigate]);

  const loadOffers = async (currentUser: { uid: string }) => {
    setLoadingOffers(true);
    setError(null);

    try {
      // -------------------------------------------
      // 1) Fetch BitLabs Offers (games/apps)
      // -------------------------------------------
      const blRes = await fetch("https://api.bitlabs.ai/v2/client/offers", {
        headers: {
          "X-Api-Token": BITLABS_KEY,
          "X-User-Id": currentUser.uid,
          "X-Api-Sdk": "CUSTOM",
        },
      });

      let bitlabsOffers: Offer[] = [];

      if (blRes.ok) {
        const json = await blRes.json();
        const rawOffers = (json?.data?.offers || []) as any[];

        bitlabsOffers = rawOffers.map((o) => {
          const payout =
            typeof o.payout === "number"
              ? o.payout
              : parseFloat(o.points ?? o.reward ?? 0) / 100;

          return {
            id: `bitlabs_${o.id}`,
            title: o.title || "Game offer",
            payout: isNaN(payout) ? 0 : payout,
            image_url:
              o.image_url ??
              o.icon_url ??
              o.app_metadata?.screenshot_urls?.[0] ??
              null,
            click_url: o.click_url ?? "#",
            est_minutes:
              typeof o.est_minutes === "number"
                ? o.est_minutes
                : o.hours_left
                ? o.hours_left * 60
                : null,
            disclaimer: o.disclaimer ?? null,
            objectives: undefined,
            provider: "bitlabs",
          };
        });
      }

      // -------------------------------------------
      // 2) Create AdGem wall hub card
      //    (Full-screen wall, many games inside)
      // -------------------------------------------
      const adgemWallUrl = `${ADGEM_WALL_BASE}?appid=${ADGEM_APP_ID}&playerid=${encodeURIComponent(
        currentUser.uid
      )}`;

      const adgemWallOffer: Offer = {
        id: "adgem_wall",
        title: "AdGem Game Wall",
        payout: 0, // payout varies per game inside the wall
        image_url: null,
        click_url: adgemWallUrl,
        est_minutes: null,
        disclaimer:
          "Opens the full AdGem game wall with tons of install-and-play offers. Rewards are credited back to ReadyBread automatically when you complete goals. If you have an issue with one of their offers, please contact AdGem support via their webwall.",
        objectives: undefined,
        provider: "adgem",
        isWall: true,
      };

      // -------------------------------------------
      // 3) Combine: BitLabs individual games + AdGem wall hub
      // -------------------------------------------
      const combined: Offer[] = SHOW_ADGEM_WALL
        ? [...bitlabsOffers, adgemWallOffer]
        : [...bitlabsOffers];

      setOffers(combined);
    } catch (err) {
      console.error(err);
      setError("Failed to load offers.");
    } finally {
      setLoadingOffers(false);
    }
  };

  const toggleMoreInfo = (offerId: string) => {
    setExpandedOfferId((prev) => (prev === offerId ? null : prev === offerId ? null : offerId));
    setExpandedOfferId((prev) => (prev === offerId ? null : offerId));
  };

  const handleStartOffer = async (offer: Offer) => {
    if (!user) {
      alert("Please log in to start an offer.");
      navigate("/login");
      return;
    }

    // Open first (so browser treats it as a direct user gesture)
    if (offer.click_url && offer.click_url !== "#") {
      if (offer.isWall) {
        // Full-screen AdGem wall experience
        window.open(offer.click_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(offer.click_url, "_blank");
      }
    } else {
      alert("Offer link is currently unavailable.");
    }

    // Then log the started offer asynchronously (non-blocking for the user)
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
          source:
            offer.provider === "adgem" ? "adgem-offers" : "bitlabs-offers",
          status: "started",
          startedAt: serverTimestamp(),
          lastUpdatedAt: serverTimestamp(),
          totalObjectives,
          completedObjectives: 0,
          type: "game",
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to log started offer:", err);
    }
  };

  if (loading) {
    return (
      <main className="rb-content theme-games">
        <section className="earn-shell">
          <p className="rb-section-sub">Loading your offers…</p>
        </section>
      </main>
    );
  }

  if (!user) {
    // Effect already navigates; this just prevents rendering flicker.
    return null;
  }

  // Filter + sort view model
  const filteredOffers =
    filter === "all"
      ? offers
      : offers.filter((o) =>
          filter === "bitlabs"
            ? o.provider === "bitlabs"
            : o.provider === "adgem"
        );

  const sortedOffers = [...filteredOffers].sort((a, b) => {
    if (sortMode === "highest") {
      return b.payout - a.payout; // high → low
    }

    if (sortMode === "fastest") {
      const aTime = a.est_minutes ?? 9999;
      const bTime = b.est_minutes ?? 9999;
      return aTime - bTime; // low → high
    }

    // Recommended: payout per minute ratio
    const aScore = (a.payout || 0) / Math.max(a.est_minutes || 1, 1);
    const bScore = (b.payout || 0) / Math.max(b.est_minutes || 1, 1);
    return bScore - aScore;
  });

  return (
    <AntiFraudGate featureName="game offers">
      <main className="rb-content theme-games">
      <section className="earn-shell">
        <div className="earn-header">
          <div>
            <h2 className="rb-section-title">
              <span className="emoji">🎮</span> Game &amp; App Offers
            </h2>
            <p className="rb-section-sub">
              Install and play games from multiple partners to earn{" "}
              <i>big</i>.
            </p>

            <div className="offer-sort-tabs">
              <button
                className={
                  sortMode === "recommended" ? "sort-tab active" : "sort-tab"
                }
                onClick={() => setSortMode("recommended")}
              >
                🔥 Recommended
              </button>

              <button
                className={
                  sortMode === "highest" ? "sort-tab active" : "sort-tab"
                }
                onClick={() => setSortMode("highest")}
              >
                💰 Highest Earnings
              </button>

              <button
                className={
                  sortMode === "fastest" ? "sort-tab active" : "sort-tab"
                }
                onClick={() => setSortMode("fastest")}
              >
                ⏱️ Fastest
              </button>
            </div>

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
                  ? `${offers.length} live entries (BitLabs${SHOW_ADGEM_WALL ? " + AdGem hub" : ""})`
                  : loadingOffers
                  ? "Checking offers…"
                  : "No active offers at the moment"}
              </span>
            </div>
          </div>
        </div>

        {loadingOffers && (
          <div className="survey-empty">Loading offers…</div>
        )}

        {!loadingOffers && error && (
          <div className="survey-empty">{error}</div>
        )}

        {!loadingOffers && !error && offers.length === 0 && (
          <div className="survey-empty">
            No offers available right now. Try again later.
          </div>
        )}

        {!loadingOffers && !error && offers.length > 0 && (
          <div className="survey-list">
            {sortedOffers.map((offer) => {
              const isExpanded = expandedOfferId === offer.id;

              return (
                <div
                  key={offer.id}
                  className={`survey-card rb-card modern-card ${
                    offer.isWall ? "adgem-wall-card" : ""
                  }`}
                >
                  <div className="offer-main">
                    <div className="offer-header-row">
                      <div className="offer-thumb">
                        <div className="offer-thumb-inner">
                          {offer.image_url ? (
                            <img src={offer.image_url} alt={offer.title} />
                          ) : (
                            <span className="rb-emoji">
                              {offer.provider === "adgem" ? "💎" : "🎮"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="offer-copy">
                        <h3 className="glow-soft">{offer.title}</h3>
                        <p className="offer-tags">
                          {!offer.isWall && (
                            <span className="chip chip-payout">
                              ${offer.payout.toFixed(2)} total
                            </span>
                          )}
                          {!offer.isWall && (
                            <span className="chip chip-time">
                              ~{offer.est_minutes || "?"} min
                            </span>
                          )}
                          <span className="chip chip-provider">
                            {offer.provider === "adgem"
                              ? "AdGem Games"
                              : "BitLabs Games"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="offer-details">
                        {offer.isWall ? (
                          <>
                            <h4>How this hub works</h4>
                            <p className="offer-details-copy">
                              This opens the full-screen AdGem game wall in a
                              new tab. Inside it you&apos;ll find lots of
                              install-and-play offers. Complete goals in those
                              games, and AdGem will send rewards back to
                              ReadyBread, which credits your balance
                              automatically.
                            </p>
                            {offer.disclaimer && (
                              <p className="offer-disclaimer">
                                {offer.disclaimer}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
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
                                goals for the offer. You&apos;ll receive the
                                full <b>${offer.payout.toFixed(2)}</b> once
                                completion is confirmed.
                              </p>
                            )}

                            {offer.disclaimer && (
                              <p className="offer-disclaimer">
                                {offer.disclaimer}
                              </p>
                            )}

                            <p className="offer-details-note">
                              Tip: Make sure to open the offer from ReadyBread
                              and keep it installed until your reward is
                              credited.
                            </p>
                          </>
                        )}
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
                      {offer.isWall ? "Open Game Wall" : "Start Offer"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
    </AntiFraudGate>
  );
};
