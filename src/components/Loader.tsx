// src/components/Loader.tsx
import React, { useEffect, useState } from "react";

interface LoaderProps {
  show: boolean;
}

const FADE_DURATION_MS = 350; // keep in sync with CSS transition

export const Loader: React.FC<LoaderProps> = ({ show }) => {
  // Loader is always mounted, but visually hidden unless needed.
  const [shouldDisplay, setShouldDisplay] = useState(show); // controls DOM presence
  const [fadeOut, setFadeOut] = useState(false); // controls CSS fade-out

  useEffect(() => {
    if (show) {
      // show = true -> display instantly
      setShouldDisplay(true);
      setFadeOut(false);
    } else {
      // show = false -> fade out
      setFadeOut(true);

      // after fade, remove from DOM
      const timer = setTimeout(() => {
        setShouldDisplay(false);
      }, FADE_DURATION_MS);

      return () => clearTimeout(timer);
    }
  }, [show]);

  // If loader fully removed, don't render
  if (!shouldDisplay) return null;

  return (
    <div id="rb-loader" className={fadeOut ? "hidden" : ""}>
      <img
        src="/assets/emoji/icon.webp"
        alt="Loading Bread"
        className="loader-bread-img"
      />
    </div>
  );
};
