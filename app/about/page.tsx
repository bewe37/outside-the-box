"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { size, tracking, weight, leading } from "@/lib/typography";
import { boxes, type Box } from "@/lib/data";

const TRAIL_SIZE = 72;    // px width
const TRAIL_LIFE = 900;   // ms visible
const MIN_DIST = 90;      // px between spawns

interface TrailItem {
  id: number;
  src: string;
  x: number;
  y: number;
  rot: number;
  el: HTMLDivElement;
}

let idCounter = 0;

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const imgIndex = useRef(0);
  const items = useRef<TrailItem[]>([]);
  const [trailImages, setTrailImages] = useState<string[]>(() =>
    boxes.filter((b) => b.images?.length).map((b) => b.images![0])
  );

  // Fetch admin-uploaded boxes to get real image paths
  useEffect(() => {
    fetch("/api/boxes")
      .then((r) => r.json())
      .then((extra: Box[]) => {
        const all = [...boxes, ...extra].filter((b) => b.images?.length);
        setTrailImages(all.map((b) => b.images![0]));
      })
      .catch(() => {});
  }, []);

  const trailImagesRef = useRef(trailImages);
  useEffect(() => { trailImagesRef.current = trailImages; }, [trailImages]);

  // Preload every trail image into the browser cache up front so spawned
  // cards paint instantly instead of fetching on first appearance.
  const preloaded = useRef<Set<string>>(new Set());
  useEffect(() => {
    trailImages.forEach((src) => {
      if (preloaded.current.has(src)) return;
      preloaded.current.add(src);
      const img = new window.Image();
      img.decoding = "async";
      img.src = src;
    });
  }, [trailImages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function spawnAt(x: number, y: number) {
      if (!container) return;
      if (trailImagesRef.current.length === 0) return;

      if (lastPos.current) {
        const dx = x - lastPos.current.x;
        const dy = y - lastPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST) return;
      }
      lastPos.current = { x, y };

      const imgs = trailImagesRef.current;
      const src = imgs[imgIndex.current % imgs.length];
      imgIndex.current++;

      const rot = (Math.random() - 0.5) * 20;
      const w = TRAIL_SIZE;
      const h = Math.round(w * (0.9 + Math.random() * 0.5));

      const el = document.createElement("div");
      el.style.cssText = `
        position: absolute;
        left: ${x - w / 2}px;
        top: ${y - h / 2}px;
        width: ${w}px;
        height: ${h}px;
        pointer-events: none;
        z-index: 5;
        transform: rotate(${rot}deg) scale(0.4);
        opacity: 0;
        transition: opacity 260ms ease, transform 360ms cubic-bezier(0.34, 1.3, 0.64, 1);
        overflow: hidden;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      `;

      const img = document.createElement("img");
      // Request a small optimized version — trail cards are only 72px wide
      img.src = src;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      `;
      el.appendChild(img);
      container.appendChild(el);

      // Force a reflow so the initial scale(0.4)/opacity:0 is committed before
      // we flip to the target — otherwise the transition has no start state and
      // the card snaps straight to full size.
      void el.offsetWidth;

      // Trigger enter animation (next frame, after the start state is painted)
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = `rotate(${rot}deg) scale(1)`;
      });

      const item: TrailItem = { id: ++idCounter, src, x, y, rot, el };
      items.current.push(item);

      // Snap away after TRAIL_LIFE ms
      setTimeout(() => {
        el.remove();
        items.current = items.current.filter((i) => i.id !== item.id);
      }, TRAIL_LIFE);
    }

    function onMouseMove(e: MouseEvent) {
      // Don't spawn trail near the text panel (440px wide + 32px from right edge)
      if (e.clientX > window.innerWidth - 440 - 32 - 24) return;
      const rect = container!.getBoundingClientRect();
      spawnAt(e.clientX - rect.left, e.clientY - rect.top);
    }

    container.addEventListener("mousemove", onMouseMove);
    return () => container.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: '"Geist", system-ui, sans-serif',
        color: "#202020",
        backgroundColor: "#FFFFFF",
      }}
    >
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Content — left-aligned, flows from top */}
        <div
          className="about-sections"
          style={{
            position: "absolute",
            top: 80,
            right: 32,
            zIndex: 10,
            width: "min(440px, calc(100vw - 64px))",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <InfoRow label="About">
            Toronto&apos;s painted utility boxes are everywhere. Most people walk past
            them. Many don&apos;t last: boxes get replaced, decommissioned, painted over.
            This is my attempt to document them before they disappear: where they are,
            who made them, and when.{" "}
            <a
              href="https://www.streetartoronto.ca/outside-the-box"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#202020", textDecoration: "none", borderBottom: "1px solid #202020", paddingBottom: 1 }}
            >
              Read more about the program ↗
            </a>
          </InfoRow>

          <InfoRow label="How I collect">
            Every box is one I&apos;ve found and photographed myself, on foot, shot on a <RicohTooltip />.
            I track down artist credits from signage, city listings, or social media.
            If there&apos;s no credit, I say so rather than guess.
          </InfoRow>

          <InfoRow label="Finding them">
            Look for red lights. Nearly every signalised corner in Toronto has a utility
            box, and many are painted. Slow down in Leslieville, Parkdale, Kensington,
            or Trinity Bellwoods and you&apos;ll start seeing them everywhere.
          </InfoRow>

          <InfoRow label="Seen one I missed?">
            Spotted a box not in the archive, or have a better photo? Send me the
            address and I&apos;d love to hear about it.
          </InfoRow>

          {/* Email row */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingTop: 24,
          }}>
            <span style={{ fontSize: size.caption, lineHeight: leading.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#202020" }}>
              Email
            </span>
            <a
              href="mailto:bryanwinata112@gmail.com"
              style={{ fontSize: "15px", lineHeight: leading.body, letterSpacing: tracking.normal, color: "#202020", textDecoration: "none" }}
            >
              bryanwinata112@gmail.com
            </a>
          </div>
        </div>

        {/* Made by — bottom-right */}
        <div
          className="about-credit"
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            fontSize: size.meta,
            letterSpacing: tracking.normal,
            color: "#A8A8A8",
            zIndex: 10,
            pointerEvents: "auto",
          }}
        >
          A project by{" "}
          <a
            href="https://x.com/gbryanwt"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#A8A8A8", textDecoration: "none", borderBottom: "1px solid #D0D0D0", paddingBottom: 1 }}
          >
            Bryan
          </a>
        </div>

        {/* Title — bottom-left */}
        <div
          className="about-title"
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            fontSize: "clamp(28px, 4vw, 48px)",
            lineHeight: 0.92,
            letterSpacing: tracking.tight,
            fontWeight: weight.medium,
            textTransform: "uppercase",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 10,
          }}
        >
          OutsideTheBox
        </div>

      </div>
    </div>
  );
}

function RicohTooltip() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <span
        onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setPos(null)}
        style={{ borderBottom: "1px solid #202020", paddingBottom: 1, cursor: "default" }}
      >
        Ricoh GR3
      </span>
      {mounted && pos && createPortal(
        <div style={{
          position: "fixed",
          top: pos.y + 16,
          left: pos.x + 16,
          zIndex: 9999,
          pointerEvents: "none",
          background: "#FFFFFF",
          border: "1px solid #E8E8E8",
          boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          overflow: "hidden",
          width: 160,
          height: 120,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ricoh.png" alt="Ricoh GR3" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>,
        document.body
      )}
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr",
      paddingBottom: 24,
    }}>
      <span style={{
        fontSize: size.caption,
        lineHeight: leading.caption,
        letterSpacing: tracking.loose,
        textTransform: "uppercase",
        color: "#202020",
        marginBottom: 10,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: "16px",
        lineHeight: "1.6",
        letterSpacing: tracking.normal,
        color: "#202020",
        fontWeight: 400,
        textWrap: "pretty",
      } as React.CSSProperties}>
        {children}
      </span>
    </div>
  );
}
