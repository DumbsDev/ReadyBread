// src/pages/Games.tsx
// Game & App offers page, pulling shared offers from Firestore (or an optional feed URL)

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { AntiFraudGate } from "../components/AntiFraudGate";

type OfferSource = "firestore" | "feed" | "legacy";

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
  provider: string;
  isWall?: boolean;
  priority?: number;
  source?: OfferSource;
  devices?: string[];
}

const FEED_URLS = [
  "https://raw.githubusercontent.com/DumbsDev/ReadyBread-Changelog/refs/heads/main/offers.json",
];

export const Games: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useUser();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] =
    useState<"recommended" | "highest" | "fastest">("recommended");
  const [dataSource, setDataSource] = useState<OfferSource | null>(null);
  const [dataSourceTag, setDataSourceTag] = useState<string | null>(null);

  // Gate page behind auth
  useEffect(() => {
    if (loading) return;

    if (!user) {
      alert("Please log in to view game offers.");
      navigate("/login");
      return;
    }

    void loadOffers();
  }, [user, loading, navigate]);

  const mapOffer = (
    data: Record<string, any>,
    fallbackId: string,
    source: OfferSource
  ): Offer | null => {
    if (data?.isActive === false || data?.active === false || data?.hidden === true) {
      return null;
    }

    const rawObjectives = Array.isArray(data?.objectives) ? data.objectives : [];
    const objectiveList = rawObjectives
      .map((obj: any) => {
        const name = (obj?.name || obj?.label || "").toString().trim();
        const reward = Number(obj?.reward ?? obj?.amount ?? 0);
        if (!name) return null;
        return {
          name,
          reward: Number.isFinite(reward) ? reward : 0,
        };
      })
      .filter((o): o is { name: string; reward: number } => Boolean(o));
    const objectives = objectiveList.length > 0 ? objectiveList : undefined;

    const payoutFromObjectives =
      objectives?.reduce((sum, obj) => sum + (obj.reward || 0), 0) ?? 0;
    const payoutValue = Number(
      data?.payout ?? data?.totalPayout ?? data?.reward ?? payoutFromObjectives
    );

    const estMinutesRaw =
      data?.estMinutes ??
      data?.est_minutes ??
      data?.minutes ??
      data?.estTime ??
      null;

    const priorityValue = Number(data?.priority);

    const devices = Array.isArray(data?.devices)
      ? (data.devices as Array<string | null | undefined>)
          .map((d) => (d ? d.toString().toLowerCase() : null))
          .filter(Boolean) as string[]
      : undefined;

    return {
      id: data?.id?.toString() || fallbackId,
      title: data?.title || data?.name || "Game offer",
      payout: Number.isFinite(payoutValue) ? payoutValue : 0,
      image_url: data?.imageUrl || data?.image_url || data?.icon || null,
      click_url: data?.clickUrl || data?.click_url || data?.link || "#",
      est_minutes:
        typeof estMinutesRaw === "number" && isFinite(estMinutesRaw)
          ? estMinutesRaw
          : null,
      disclaimer: data?.disclaimer || data?.notes || null,
      objectives,
      provider: data?.provider || data?.network || "direct",
      isWall: Boolean(data?.isWall || data?.type === "wall"),
      priority: Number.isFinite(priorityValue) ? priorityValue : 0,
      source,
      devices,
    };
  };

  const fetchOffersFromFeed = async (): Promise<Offer[]> => {
    for (const url of FEED_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn("Games feed returned non-200", res.status, url);
          continue;
        }
        const payload = await res.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.offers)
          ? payload.offers
          : [];

        const mapped = list
          .map((item: any, idx: number) =>
            mapOffer(item, item?.id?.toString() || `feed_${idx}`, "feed")
          )
          .filter(
            (o: Offer | null | undefined): o is Offer => Boolean(o)
          );

        if (mapped.length > 0) {
          setDataSourceTag(
            url.includes("offers-test.json") ? "test fixture" : url
          );
          return mapped;
        }
      } catch (err) {
        console.warn("Failed to read games feed:", err, url);
        continue;
      }
    }
    return [];
  };

  const applyUserTokens = (list: Offer[]): Offer[] => {
    if (!user) return list;

    const uidToken = encodeURIComponent(user.uid);
    const emailToken = user.email ? encodeURIComponent(user.email) : "";
    const usernameToken =
      user.profile?.username && typeof user.profile.username === "string"
        ? encodeURIComponent(user.profile.username)
        : "";

    return list.map((offer) => {
      const urlWithTokens = (offer.click_url || "#")
        .replace(/\{UID\}|\{USER_ID\}|\{USERID\}/gi, uidToken)
        .replace(/\{EMAIL\}/gi, emailToken)
        .replace(/\{USERNAME\}/gi, usernameToken);

      return {
        ...offer,
        click_url: urlWithTokens,
      };
    });
  };

  const detectDevice = (): string => {
    if (typeof navigator === "undefined") return "unknown";
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return "ios";
    if (/android/.test(ua)) return "android";
    if (/windows/.test(ua)) return "windows";
    if (/mac/.test(ua)) return "mac";
    if (/linux/.test(ua)) return "linux";
    return "other";
  };

  const filterByDevice = (list: Offer[]): Offer[] => {
    const device = detectDevice();
    return list.filter((offer) => {
      if (!offer.devices || offer.devices.length === 0) return true;
      return offer.devices.map((d) => d.toLowerCase()).includes(device);
    });
  };

  const loadOffers = async () => {
    setLoadingOffers(true);
    setError(null);

    try {
      const feedOffers = await fetchOffersFromFeed();
      if (feedOffers.length > 0) {
        setOffers(filterByDevice(applyUserTokens(feedOffers)));
        setDataSource("feed");
        // dataSourceTag is set in fetchOffersFromFeed when a URL succeeds
        return;
      }

      setOffers([]);
      setDataSource(null);
      setError(
        "No game offers found. Add docs under gameOffers in Firestore or point VITE_GAMES_FEED_URL at a JSON feed."
      );
    } catch (err) {
      console.error(err);
      setError(
        "Failed to load game offers. Check Firestore permissions or your feed URL."
      );
    } finally {
      setLoadingOffers(false);
    }
  };

  const toggleMoreInfo = (offerId: string) => {
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
        // Full-screen wall experience
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
          source: `${offer.provider || "game"}-offers`,
          status: "started",
          startedAt: serverTimestamp(),
          lastUpdatedAt: serverTimestamp(),
          totalObjectives,
          completedObjectives: 0,
          objectives: offer.objectives?.map((obj) => ({
            label: obj.name,
            reward: obj.reward,
          })),
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
          <p className="rb-section-sub">Loading your offers...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    // Effect already navigates; this just prevents rendering flicker.
    return null;
  }

  const sortedOffers = [...offers].sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);

    if (sortMode === "highest") {
      const payoutDiff = b.payout - a.payout;
      return payoutDiff !== 0 ? payoutDiff : priorityDiff;
    }

    if (sortMode === "fastest") {
      const aTime = a.est_minutes ?? 9999;
      const bTime = b.est_minutes ?? 9999;
      const timeDiff = aTime - bTime;
      return timeDiff !== 0 ? timeDiff : priorityDiff;
    }

    // Recommended: priority first, then payout per minute ratio
    if (priorityDiff !== 0) return priorityDiff;
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
                <span className="emoji" aria-hidden="true">🎮</span> Game &amp; App Offers
              </h2>
              <p className="rb-section-sub">
                Install and play games pulled straight from your shared offers
                list.
              </p>

              <div className="offer-sort-tabs">
                <button
                  className={
                    sortMode === "recommended" ? "sort-tab active" : "sort-tab"
                  }
                  onClick={() => setSortMode("recommended")}
                >
                  Recommended
                </button>

                <button
                  className={
                    sortMode === "highest" ? "sort-tab active" : "sort-tab"
                  }
                  onClick={() => setSortMode("highest")}
                >
                  Highest Earnings
                </button>

                <button
                  className={
                    sortMode === "fastest" ? "sort-tab active" : "sort-tab"
                  }
                  onClick={() => setSortMode("fastest")}
                >
                  Fastest
                </button>
              </div>

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
                    ? `${offers.length} live entries${dataSource ? ` (${dataSource}${dataSourceTag ? ` - ${dataSourceTag}` : ""})` : ""}`
                    : loadingOffers
                    ? "Checking offers..."
                    : "No active offers yet"}
                </span>
                {dataSource === null && !loadingOffers && (
                  <span className="chip chip-provider">
                    Add offers in Firestore or set VITE_GAMES_FEED_URL
                  </span>
                )}
              </div>
            </div>
          </div>

          {loadingOffers && <div className="survey-empty">Loading offers...</div>}

          {!loadingOffers && error && (
            <div className="survey-empty">{error}</div>
          )}

          {!loadingOffers && !error && offers.length === 0 && (
            <div className="survey-empty">
              No offers available right now. Add offers to Firestore or connect a
              feed and refresh.
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
                              <span className="rb-emoji">dYZr</span>
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
                              {offer.provider}
                            </span>
                            {offer.source && (
                              <span className="chip chip-time">
                                {offer.source}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="offer-details">
                          {offer.isWall ? (
                            <>
                              <h4>How this hub works</h4>
                              <p className="offer-details-copy">
                                This opens the game wall in a new tab. Offers in
                                the wall are still tied to your ReadyBread ID.
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
                                  Complete the in-app goals to receive the full{" "}
                                  <b>${offer.payout.toFixed(2)}</b>.
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
