// src/pages/prefabs/gameCard.tsx
import React, { useEffect, useRef, useState } from "react";
import "./gameCard.css";

interface Objective {
  label: string;
  reward: number;
  rewardFinal?: number;
  rewardWithBonus?: number;
  completed?: boolean;
}

interface GameCardProps {
  name: string;
  blurb: string;
  description: string;
  thumbnail: string;
  images: string[];
  objectives: Objective[];
  totalRevenue: number;
  cardType: string; // emoji
  downloadLink: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideCardShell?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
  name,
  blurb,
  description,
  thumbnail,
  images,
  objectives,
  totalRevenue,
  cardType,
  downloadLink,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  hideCardShell = false,
}) => {
  const fallbackImg = "src/static/images/icon.webp";
  const displayImages = images && images.length > 0 ? images : [fallbackImg];

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof openProp === "boolean";
  const isOpen = isControlled ? (openProp as boolean) : internalOpen;
  const setOpenState = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!isControlled && defaultOpen) {
      setInternalOpen(true);
    }
  }, [defaultOpen, isControlled]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const totalImages = displayImages.length;

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % totalImages);
  const prevImage = () =>
    setCurrentIndex((prev) => (prev - 1 + totalImages) % totalImages);

  // Tilt effect on outer card
  const cardRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current == null || touchEndX.current == null) return;
    const distance = touchStartX.current - touchEndX.current;
    const threshold = 60;

    if (distance > threshold) nextImage(); // swipe left
    if (distance < -threshold) prevImage(); // swipe right

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / rect.height) * -8;
    const rotateY = ((x - rect.width / 2) / rect.width) * 8;
    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  };

  const handleLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "rotateX(0deg) rotateY(0deg) translateY(0)";
  };

  return (
    <>
      {/* Card display */}
      {!hideCardShell && (
      <div
        ref={cardRef}
        className="gc-card-outer"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={() => setOpenState(true)}
      >
        <div className="gc-card-inner">
          <div className="gc-thumb-wrapper">
            <img
              src={thumbnail || fallbackImg}
              alt={name}
              className="gc-thumb"
            />
            <div className="gc-earnings-tag">💰 ${totalRevenue.toFixed(2)}</div>
            <div className="gc-type-thumb">{cardType}</div>
          </div>

          <div className="gc-lower">
            <div className="gc-info-text">
              <h3 className="gc-title">{name}</h3>
              <p className="gc-blurb">{blurb}</p>

              <button
                className="gc-play-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenState(true);
                }}
              >
                Play {name} and earn ${totalRevenue.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Modal popup */}
      {isOpen && (
        <div className="gc-modal-overlay" onClick={() => setOpenState(false)}>
          <div className="gc-modal" onClick={(e) => e.stopPropagation()}>
            <div
              className="gc-carousel"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <button className="gc-carousel-btn left" onClick={prevImage}>
                ←
              </button>

              <img
                src={displayImages[currentIndex]}
                alt={`${name} screenshot`}
                className="gc-carousel-image"
              />

              <button className="gc-carousel-btn right" onClick={nextImage}>
                →
              </button>
            </div>

            <div className="gc-modal-scroll">
              {/* PROGRESS SUMMARY */}
              {objectives.length > 0 && (
                <div className="gc-progress-row">
                  {(() => {
                    const completed = objectives.filter((o) => o.completed).length;
                    const total = objectives.length;
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return (
                      <>
                        <div className="gc-progress-text">
                          <span>Progress:</span>
                          <strong>
                            {completed}/{total} completed
                          </strong>
                        </div>
                        <div className="gc-progress-bar">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <h2 className="gc-modal-title">{name}</h2>
              <p className="gc-modal-description">{description}</p>

              <a
                href={downloadLink}
                target="_blank"
                rel="noopener noreferrer"
                className="gc-download-btn"
              >
                Download {name}
              </a>

              <h3 className="gc-objectives-title">Objectives</h3>
              <div className="gc-objectives-list">
                {objectives.map((obj, idx) => (
                  <div key={idx} className="gc-objective">
                    {(() => {
                      const rewardOptions = [
                        obj.rewardFinal,
                        obj.rewardWithBonus,
                        obj.reward,
                      ].map((v) => (typeof v === "number" && isFinite(v) ? v : null));
                      const rewardValue =
                        rewardOptions.find((v) => v !== null) ?? 0;

                      return (
                        <>
                    <span
                      className={`gc-objective-step ${
                        obj.completed ? "done" : ""
                      }`}
                    >
                      {obj.completed ? "✓" : idx + 1}
                    </span>
                    <span className="gc-objective-text">{obj.label}</span>
                    <span className="gc-objective-reward">
                      +${rewardValue.toFixed(2)}
                    </span>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>

              <div className="gc-extra-info">
                <div>✓ ReadyBread Direct Offer</div>
              </div>
            </div>

            <button className="gc-modal-close" onClick={() => setOpenState(false)}>
              X
            </button>
          </div>
        </div>
      )}
    </>
  );
};
