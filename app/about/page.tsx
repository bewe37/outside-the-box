"use client";

import React, { useEffect, useState } from "react";
import { tracking } from "@/lib/typography";
import { useSetDarkTheme } from "@/app/components/theme-context";

export default function AboutPage() {
  useSetDarkTheme(true);
  // Left inset matches the nav's "Information" tab — kept in sync via an
  // event the nav publishes so nav spacing changes can't desync it.
  const [leftInset, setLeftInset] = useState(24);

  useEffect(() => {
    // Measure the nav's "Information" tab directly on mount — the nav also
    // broadcasts "nav-info-x", but that single fire can happen before this
    // page mounts its listener (a race that left the content stuck at the
    // default inset on some viewports). Reading the element ourselves after
    // layout settles is race-free; the event then keeps it in sync on
    // resize / dial changes.
    const measure = () => {
      // Phones: aligning to "Information" (~270px in) would leave a sliver
      // of a text column — use a plain edge inset instead.
      if (window.innerWidth < 640) {
        setLeftInset(16);
        return;
      }
      const el = document.getElementById("nav-info-tab");
      if (el) setLeftInset(el.getBoundingClientRect().left);
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("nav-info-x", measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("nav-info-x", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Content's left edge matches "Information" exactly — both measured from
  // the same viewport origin, so no correction offset is needed.
  const contentLeft = leftInset;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: '"Geist", system-ui, sans-serif',
        color: "#FFFFFF",
        backgroundColor: "#000000",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            boxSizing: "border-box",
            paddingTop: "clamp(16px, 3vh, 28px)",
            paddingLeft: contentLeft,
            paddingRight: 24,
            paddingBottom: 96,
          }}
        >
        <div
          style={{
            // No width cap — text runs to the container's right padding
            // (24px), lining up with the nav's "Contact" on the far edge.
            display: "flex",
            flexDirection: "column",
            gap: 28,
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.6,
            letterSpacing: tracking.normal,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <SectionLabel>About</SectionLabel>
              <div>
                Toronto&apos;s painted utility boxes are everywhere. Most
                people walk past them. Many don&apos;t last: boxes get
                replaced, decommissioned, painted over. This is my attempt to
                document them before they disappear: where they are, who made
                them, and when.{" "}
                <a href="https://www.streetartoronto.ca/outside-the-box" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  Read more about the program ↗
                </a>
              </div>
            </div>
            <div>
              Every box is one I&apos;ve found and photographed myself, on
              foot, shot on a Ricoh GR3. I track down artist credits from
              signage, city listings, or social media. If there&apos;s no
              credit, I say so rather than guess.
            </div>
          </div>

          <div>
            <SectionLabel>Finding them</SectionLabel>
            <div>
              Look for red lights. Nearly every signalised corner in Toronto
              has a utility box, and many are painted. Slow down in
              Leslieville, Parkdale, Kensington, or Trinity Bellwoods and
              you&apos;ll start seeing them everywhere.
            </div>
          </div>

          <div>
            <SectionLabel>Seen one I missed?</SectionLabel>
            <div>
              Spotted a box not in the archive, or have a better photo?{" "}
              <a href="mailto:bryanwinata112@gmail.com" style={linkStyle}>Send me the address</a>{" "}
              and I&apos;d love to hear about it.
            </div>
          </div>

          {/* Copyright — muted, set apart from the sections above. */}
          <div style={{ marginTop: 48, color: "rgba(255,255,255,0.55)" }}>
            © 2026 Bryan Winata
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  color: "#FFFFFF",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

// Same size as the body text, in a subtle grey so titles read as markers
// rather than headings.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4, color: "rgba(255,255,255,0.55)" }}>
      {children}
    </div>
  );
}
