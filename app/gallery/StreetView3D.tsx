"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { formatNeighbourhood, formatYear, type Box } from "@/lib/data";
import { size, tracking, weight, leading } from "@/lib/typography";

// Varied heights for masonry rhythm
const HEIGHTS = [520, 360, 490, 580, 330, 465, 405, 545, 315, 475, 435, 370];
function cardH(id: number) { return HEIGHTS[id % HEIGHTS.length]; }

// Tiny shared blur placeholder. Paints instantly while the real image streams in.
// Inline SVG works as a data URL in `next/image` placeholders without base64.
const BLUR_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23E8E8E8"/></svg>';
// The gallery only renders boxes with uploads, so the first image is the cover.
function cardSrc(box: Box) {
  return box.images?.[0] ?? "";
}

const META_THRESHOLD = 4; // columns <= this → show metadata below image

// Small label/value pair used in the masonry card's metadata strip.
function CardMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: size.caption,
          lineHeight: leading.caption,
          letterSpacing: tracking.loose,
          textTransform: "uppercase",
          color: "#A8A8A8",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: size.meta,
          lineHeight: leading.meta,
          letterSpacing: tracking.normal,
          color: "#202020",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function MasonryCard({
  box,
  collected,
  showMeta,
  onSelect,
  onCollect,
}: {
  box: Box;
  collected: boolean;
  showMeta: boolean;
  onSelect: (box: Box) => void;
  onCollect: (id: number) => void;
}) {
  const h = cardH(box.id);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: "block" }}>
      {/* Image */}
      <div
        className="masonry-img"
        style={{ position: "relative", overflow: "hidden", cursor: "pointer", display: "block" }}
        onClick={() => onSelect(box)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Image
          src={cardSrc(box)}
          alt={box.title}
          width={600}
          height={h}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          quality={75}
          style={{ width: "100%", height: "auto", display: "block", objectFit: "cover", filter: "saturate(1.15)" }}
          loading="lazy"
        />


        {/* Collect button — top-left on hover (always visible on mobile) */}
        <div
          className="collect-btn-wrap"
          style={{
            position: "absolute", top: 8, left: 8,
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.2s ease, transform 0.2s ease",
            transform: hovered ? "scale(1)" : "scale(0.85)",
          }}
          onClick={(e) => { e.stopPropagation(); onCollect(box.id); }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: collected ? "#202020" : "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            cursor: "pointer",
          }}>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              {collected ? (
                <path d="M1 4.5L3.5 7L8 1.5" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter" />
              ) : (
                <path d="M4.5 1V8M1 4.5H8" stroke="#202020" strokeWidth="1.4" strokeLinecap="square" />
              )}
            </svg>
          </div>
        </div>

      </div>

      {/* Metadata — collapses when column count exceeds threshold */}
      <div
        style={{
          maxHeight: showMeta ? 100 : 0,
          opacity: showMeta ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.32s ease, opacity 0.22s ease",
        }}
      >
        <div style={{ padding: "10px 2px 12px" }}>
          <div
            style={{
              fontSize: size.meta,
              lineHeight: leading.meta,
              letterSpacing: tracking.normal,
              fontWeight: weight.medium,
              textTransform: "uppercase",
              color: "#202020",
              marginBottom: 4,
            }}
          >
            {box.title}
          </div>
          <div style={{ fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.normal, color: "#202020", fontWeight: 400 }}>
            {[box.artist, formatNeighbourhood(box.neighbourhood), formatYear(box.year)].join(" · ")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Masonry view ─────────────────────────────────────────────────────────────

export default function MasonryView({
  boxes,
  collected,
  onCollect,
  onSelect,
  columns = 3,
}: {
  boxes: Box[];
  collected: Set<number>;
  onCollect: (id: number) => void;
  onSelect: (box: Box) => void;
  columns?: number;
}) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeColumns, setActiveColumns] = useState(columns);
  const showMeta = activeColumns <= META_THRESHOLD;
  const prevColumns = useRef(columns);
  const isFirstMount = useRef(true);

  // Entrance animation on mount
  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean);
    if (!cards.length) return;
    gsap.killTweensOf(cards);
    gsap.fromTo(
      cards,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.45, ease: "power2.out", clearProps: "transform,opacity" }
    );
    isFirstMount.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes]);

  // Column change: scale out → swap count → scale in
  useEffect(() => {
    if (isFirstMount.current || columns === prevColumns.current) return;
    prevColumns.current = columns;
    const cards = cardRefs.current.filter(Boolean);
    if (!cards.length) { setActiveColumns(columns); return; }

    gsap.killTweensOf(cards);
    gsap.to(cards, {
      scale: 0.88,
      opacity: 0,
      duration: 0.14,
      ease: "power2.in",
      onComplete: () => {
        setActiveColumns(columns);
        requestAnimationFrame(() => {
          const fresh = cardRefs.current.filter(Boolean);
          gsap.killTweensOf(fresh);
          gsap.fromTo(
            fresh,
            { scale: 0.92, opacity: 0 },
            { scale: 1, opacity: 1, stagger: 0.02, duration: 0.28, ease: "power2.out", clearProps: "transform,opacity" }
          );
        });
      },
    });
  }, [columns]);

  return (
    <div className="photos-scroll" style={{ flex: 1, overflowY: "auto", padding: 20, paddingTop: 48 }}>
      <div className="masonry-grid" style={{ columnCount: activeColumns, columnGap: 20 }}>
        {boxes.map((box, i) => (
          <div
            key={box.id}
            ref={(el) => { cardRefs.current[i] = el; }}
            style={{ breakInside: "avoid", marginBottom: 20 }}
          >
            <MasonryCard
              box={box}
              collected={collected.has(box.id)}
              showMeta={showMeta}
              onSelect={onSelect}
              onCollect={onCollect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
