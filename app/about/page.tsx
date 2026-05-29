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
      img.src = src;
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

        {/* Sections */}
        <div
          className="about-sections"
          style={{
            position: "absolute",
            top: "46%",
            left: "42%",
            translate: "-50% -50%",
            zIndex: 10,
          }}
        >
          <Section indent={0} label="About">
            Toronto is covered in painted utility boxes — electrical cabinets, traffic
            control pedestals, telecom enclosures — wrapped in murals by local artists.
            Most people walk past them every day without stopping. This is my attempt
            to document them: where they are, who made them, and when. Not exhaustive,
            not official. Just one person paying attention.
          </Section>

          <Section indent={1} label="How I collect">
            Every box here is one I&apos;ve found and photographed myself, on foot. I
            shoot with my phone, record the address and neighbourhood, and track down
            the artist credit where I can — from signage on the box, city program
            listings, or the artist&apos;s own social media. Some boxes have no
            credit at all; I note that too rather than guess.
          </Section>

          <Section indent={2} label="Finding them">
            The easiest rule: look for red lights. Nearly every signalised intersection
            in Toronto has a utility box on the corner, and many of them are painted.
            If you&apos;re walking through Leslieville, Parkdale, Kensington, or
            Trinity Bellwoods — slow down at the corners and you&apos;ll start seeing
            them everywhere.
          </Section>

          <Section indent={3} label="Seen one I missed?">
            If you&apos;ve spotted a box that isn&apos;t in the archive — or you have
            a better photo, a correction to an artist credit, or just want to say
            hello — I&apos;d genuinely love to hear about it. Send me the address and
            a photo.
            <br /><br />
            <a
              href="mailto:bryanwinata112@gmail.com"
              style={{
                color: "#202020",
                letterSpacing: tracking.normal,
                textDecoration: "none",
                borderBottom: "1px solid #202020",
                paddingBottom: 1,
              }}
            >
              bryanwinata112@gmail.com
            </a>
          </Section>
        </div>

        {/* Made by — bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            fontSize: size.caption,
            letterSpacing: tracking.loose,
            color: "#A8A8A8",
            zIndex: 10,
            pointerEvents: "auto",
          }}
        >
          Made by{" "}
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

const INDENT_STEP = 140;

function Section({
  indent,
  label,
  children,
}: {
  indent: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginLeft: indent * INDENT_STEP,
        marginTop: indent === 0 ? 0 : 52,
        maxWidth: 560,
      }}
    >
      <div
        style={{
          fontSize: size.caption,
          lineHeight: leading.caption,
          letterSpacing: tracking.loose,
          textTransform: "uppercase",
          color: "#202020",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: size.body,
          lineHeight: leading.body,
          letterSpacing: tracking.normal,
          color: "#202020",
        }}
      >
        {children}
      </div>
    </div>
  );
}
