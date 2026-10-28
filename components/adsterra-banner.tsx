"use client";

import { useEffect, useRef, useState } from "react";

interface AdsterraIframeProps {
  adKey: string;
  width: number;
  height: number;
  className?: string;
}

export function AdsterraIframe({ adKey, width, height, className = "" }: AdsterraIframeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{ width: "100%", maxWidth: width, height }}
        className={`flex items-center justify-center bg-transparent ${className}`}
      />
    );
  }

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '${adKey}',
      'format' : 'iframe',
      'height' : ${height},
      'width' : ${width},
      'params' : {}
    };
  </script>
  <script type="text/javascript" src="https://www.highrevenueformat.com/${adKey}/invoke.js"></script>
</body>
</html>`;

  return (
    <iframe
      srcDoc={htmlContent}
      width={width}
      height={height}
      title={`Advertisement ${width}x${height}`}
      style={{
        width: "100%",
        maxWidth: `${width}px`,
        height: `${height}px`,
        border: "none",
        overflow: "hidden",
        display: "block",
      }}
      loading="lazy"
      scrolling="no"
      className={className}
    />
  );
}

/**
 * 300x250 Medium Rectangle Ad Card
 * Blends naturally into grid of subject cards, quiz cards, and horizontal unit track.
 */
export function AdsterraCard300x250({
  variant = "grid",
  className = "",
}: {
  variant?: "grid" | "unit";
  className?: string;
}) {
  return (
    <div
      className={`card flex flex-col items-center justify-center text-center overflow-hidden transition-all ${
        variant === "unit" ? "unit shrink-0" : ""
      } ${className}`}
      style={{
        minHeight: "290px",
        padding: "16px 12px",
      }}
    >
      <span
        className="pill mb-2.5"
        style={{
          alignSelf: "center",
          fontSize: "10px",
          padding: "3px 10px",
          letterSpacing: "0.05em",
          opacity: 0.75,
        }}
      >
        Sponsored
      </span>
      <div className="w-full flex items-center justify-center overflow-hidden flex-1">
        <AdsterraIframe
          adKey="4e67dbadfd898257ceafdab7dfc40fa8"
          width={300}
          height={250}
        />
      </div>
    </div>
  );
}

/**
 * 728x90 Leaderboard Ad
 * Sits elegantly below navbar or between main sections. Responsive with mobile fallbacks.
 */
export function AdsterraLeaderboard728x90({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full flex flex-col items-center justify-center my-6 overflow-hidden px-2 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--mute)] opacity-50 mb-1.5">
        Sponsored
      </span>
      <div
        className="w-full max-w-[760px] p-2.5 rounded-[var(--r)] flex items-center justify-center overflow-x-auto"
        style={{
          background: "var(--bg)",
          boxShadow: "var(--raise-s)",
        }}
      >
        <AdsterraIframe
          adKey="68a4cfb832e0dbda70ffee1744c6637c"
          width={728}
          height={90}
        />
      </div>
    </div>
  );
}

/**
 * 468x60 Standard Banner Ad
 * Fits well between content sections and above footers.
 */
export function AdsterraBanner468x60({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full flex flex-col items-center justify-center my-5 overflow-hidden px-2 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--mute)] opacity-50 mb-1.5">
        Sponsored
      </span>
      <div
        className="w-full max-w-[500px] p-2 rounded-[var(--r)] flex items-center justify-center overflow-x-auto"
        style={{
          background: "var(--bg)",
          boxShadow: "var(--raise-s)",
        }}
      >
        <AdsterraIframe
          adKey="c9cae17e7578a9c80be95a4121eb5c8e"
          width={468}
          height={60}
        />
      </div>
    </div>
  );
}
