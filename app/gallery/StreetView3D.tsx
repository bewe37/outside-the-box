"use client";

import { useRef, useEffect } from "react";
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
}: {
  box: Box;
  collected: boolean;
  showMeta: boolean;
  onSelect: (box: Box) => void;
}) {
  const h = cardH(box.id);

  return (
    <div style={{ display: "block" }}>
      {/* Image */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
          display: "block",
        }}
        onClick={() => onSelect(box)}
      >
        <Image
          src={cardSrc(box)}
          alt={box.title}
          width={600}
          height={h}
          style={{ width: "100%", height: "auto", display: "block", objectFit: "cover", filter: "saturate(1.15)" }}
          unoptimized
          loading="lazy"
          placeholder="blur"
          blurDataURL={BLUR_PLACEHOLDER}
        />

        {/* Collected dot */}
        {collected && (
          <div
            style={{
              position: "absolute",
              top: 9,
              right: 9,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          />
        )}
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
          {/* Title */}
          <div
            style={{
              fontSize: size.meta,
              lineHeight: leading.meta,
              letterSpacing: tracking.normal,
              fontWeight: weight.medium,
              textTransform: "uppercase",
              color: "#202020",
              marginBottom: 6,
            }}
          >
            {box.title}
          </div>

          {/* Meta */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <CardMeta label="Artist" value={box.artist} />
            <CardMeta label="Year" value={formatYear(box.year)} />
            <CardMeta label="Neighbourhood" value={formatNeighbourhood(box.neighbourhood)} />
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
  const showMeta = columns <= META_THRESHOLD;

  // Stagger entrance on mount and when boxes or column count changes
  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, boxes.length);
    const cards = cardRefs.current.filter(Boolean);
    if (!cards.length) return;

    gsap.fromTo(
      cards,
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.04,
        duration: 0.45,
        ease: "power2.out",
        clearProps: "transform",
      }
    );
  }, [boxes]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 8, paddingTop: 0 }}>
      <div
        style={{
          columnCount: columns,
          columnGap: 12,
        }}
      >
        {boxes.map((box, i) => (
          <div
            key={box.id}
            ref={(el) => { cardRefs.current[i] = el; }}
            style={{ breakInside: "avoid", marginBottom: 12 }}
          >
            <MasonryCard
              box={box}
              collected={collected.has(box.id)}
              showMeta={showMeta}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
