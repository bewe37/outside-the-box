"use client";

import React, { useEffect, useRef, useState } from "react";
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
        transform: rotate(${rot}deg) scale(0.9);
        opacity: 0;
        transition: opacity 300ms ease, transform 300ms ease;
        overflow: hidden;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      `;

      const img = document.createElement("img");
      // Request a small optimized version — trail cards are only 72px wide
      img.src = `/_next/image?url=${encodeURIComponent(src)}&w=128&q=60`;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      `;
      el.appendChild(img);
      container.appendChild(el);

      // Trigger enter animation
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

        {/* Content — pinned to right ~45% */}
        <div
          className="about-sections"
          style={{
            position: "absolute",
            top: "50%",
            right: 32,
            translate: "0 -50%",
            zIndex: 10,
            width: "min(420px, calc(100vw - 48px))",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <InfoRow label="About">
            Toronto&apos;s painted utility boxes are everywhere. Most people walk past
            them. This is my attempt to document them: where they are, who made them,
            and when.
          </InfoRow>

          <InfoRow label="How I collect">
            Every box is one I&apos;ve found and photographed myself, on foot.
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
              style={{ fontSize: size.body, lineHeight: leading.body, letterSpacing: tracking.normal, color: "#202020", textDecoration: "none" }}
            >
              bryanwinata112@gmail.com
            </a>
          </div>
        </div>

        {/* Made by — bottom-right */}
        <div
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr",
      paddingBottom: 28,
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
        fontSize: size.body,
        lineHeight: leading.body,
        letterSpacing: tracking.normal,
        color: "#202020",
      }}>
        {children}
      </span>
    </div>
  );
}
