// src/components/Loader.tsx
// Loading screen with smooth fade-out using the #rb-loader.hidden CSS

import React, { useEffect, useState } from 'react';

interface LoaderProps {
  show: boolean;  // Should the loader be visible?
}

export const Loader: React.FC<LoaderProps> = ({ show }) => {
  const [visible, setVisible] = useState(show);
  const [hiddenClass, setHiddenClass] = useState('');

  useEffect(() => {
    if (show) {
      // When loading starts again, show immediately
      setVisible(true);
      setHiddenClass('');
    } else if (visible) {
      // When loading finishes, add the .hidden class to trigger CSS fade-out
      setHiddenClass('hidden');

      const timeout = setTimeout(() => {
        setVisible(false);
      }, 400); // slightly longer than the CSS transition (0.35s)

      return () => clearTimeout(timeout);
    }
  }, [show, visible]);

  if (!visible) return null;

  return (
    <div id="rb-loader" className={hiddenClass}>
      <div className="loader-bread">🥖</div>
    </div>
  );
};
