// src/components/TiltCard.tsx
import React, { useRef } from "react";

interface TiltCardProps {
  children: React.ReactNode;
  intensity?: number; // how strong the tilt effect is
  className?: string;
}

const TiltCard: React.FC<TiltCardProps> = ({
  children,
  intensity = 15,
  className = "",
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const rotateX = (y / rect.height) * intensity;
    const rotateY = (x / rect.width) * -intensity;

    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
  };

  const handleLeave = () => {
    const card = cardRef.current;
    if (!card) return;

    card.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
  };

  return (
    <div
      ref={cardRef}
      className={`tilt-card-wrapper ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        transition: "transform 0.25s ease-out",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
};

export default TiltCard;
