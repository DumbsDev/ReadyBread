import React, { useEffect, useRef } from "react";

interface AdCode {
  key: string;
  width: number;
  height: number;
}

interface RotatingAdProps {
  ads: AdCode[];
  rotateMs?: number;
  className?: string;
}

const RotatingAd: React.FC<RotatingAdProps> = ({
  ads,
  rotateMs = 30000,
  className,
}) => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const indexRef = useRef(0);

  const loadAd = () => {
    const iframe = frameRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(""); // clear previous ad
    doc.close();

    const ad = ads[indexRef.current];

    // Create unique var inside iframe context
    const uniqueVar = "atOptions_" + ad.key + "_" + Date.now();

    const script1 = doc.createElement("script");
    script1.type = "text/javascript";
    script1.innerHTML = `
      var ${uniqueVar} = {
        'key': '${ad.key}',
        'format': 'iframe',
        'height': ${ad.height},
        'width': ${ad.width},
        'params': {}
      };
      window.atOptions = ${uniqueVar};
    `;

    const script2 = doc.createElement("script");
    script2.type = "text/javascript";
    script2.src = `//www.highperformanceformat.com/${ad.key}/invoke.js`;

    doc.body.appendChild(script1);
    doc.body.appendChild(script2);
  };

  useEffect(() => {
    loadAd();

    const interval = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % ads.length;
      loadAd();
    }, rotateMs);

    return () => clearInterval(interval);
  }, [ads, rotateMs]);

  return (
    <iframe
      ref={frameRef}
      className={className}
      style={{
        border: "none",
        width: ads[0].width,
        height: ads[0].height,
        overflow: "hidden",
      }}
    />
  );
};

export default RotatingAd;
