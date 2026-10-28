"use client";

import React from "react";

// <marquee> is not in React's TypeScript types, so we treat it as a generic element.
const Marquee = "marquee" as unknown as React.ElementType;

interface MarqueeElement extends HTMLElement {
  start: () => void;
  stop: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    background: "#14213d",
    color: "#f1f5f9",
    padding: "10px 0",
    fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
    fontSize: "16px",
    fontWeight: 500,
  },
  link: {
    color: "#fca311",
    fontWeight: 700,
    textDecoration: "underline",
    marginLeft: "6px",
  },
};

export default function TextBanner() {
  return (
    <div style={styles.banner}>
      <Marquee
        behavior="scroll"
        direction="left"
        scrollamount="6"
        onMouseOver={(e: React.MouseEvent) =>
          (e.currentTarget as MarqueeElement).stop()
        }
        onMouseOut={(e: React.MouseEvent) =>
          (e.currentTarget as MarqueeElement).start()
        }
      >
        Developed by Zetavextech |
        <a
          href="https://zetavextech.in"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          zetavextech.in
        </a>
      </Marquee>
    </div>
  );
}
