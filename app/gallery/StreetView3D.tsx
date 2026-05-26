"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { Box } from "@/lib/data";

// Varied heights for masonry rhythm
const HEIGHTS = [520, 360, 490, 580, 330, 465, 405, 545, 315, 475, 435, 370];
function cardH(id: number) { return HEIGHTS[id % HEIGHTS.length]; }
function imgUrl(id: number, w: number, h: number) {
  return `https://picsum.photos/seed/box${id}/${w}/${h}`;
}

const META_THRESHOLD = 4; // columns <= this → show metadata below image

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
          src={imgUrl(box.id, 600, h)}
          alt={box.title}
          width={600}
          height={h}
          style={{ width: "100%", height: "auto", display: "block" }}
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
          maxHeight: showMeta ? 72 : 0,
          opacity: showMeta ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.32s ease, opacity 0.22s ease",
          borderBottom: "1px solid #EBEBEB",
        }}
      >
        <div style={{ padding: "9px 2px 10px" }}>
          {/* Title */}
          <div
            style={{
              fontSize: 10,
              letterSpacing: "-0.04em",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#202020",
              fontFamily: '"Geist", system-ui, sans-serif',
              marginBottom: 5,
              lineHeight: 1.2,
            }}
          >
            {box.title}
          </div>

          {/* Two-column meta */}
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: "0.04em",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  color: "#A8A8A8",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  marginBottom: 2,
                }}
              >
                Artist
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "-0.03em",
                  fontWeight: 500,
                  color: "#202020",
                  fontFamily: '"Geist", system-ui, sans-serif',
                }}
              >
                {box.artist}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: "0.04em",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  color: "#A8A8A8",
                  fontFamily: '"Geist", system-ui, sans-serif',
                  marginBottom: 2,
                }}
              >
                Year
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "-0.03em",
                  fontWeight: 500,
                  color: "#202020",
                  fontFamily: '"Geist", system-ui, sans-serif',
                }}
              >
                {box.year}
              </div>
            </div>
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
    <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
      <div
        style={{
          columnCount: columns,
          columnGap: 4,
        }}
      >
        {boxes.map((box, i) => (
          <div
            key={box.id}
            ref={(el) => { cardRefs.current[i] = el; }}
            style={{ breakInside: "avoid", marginBottom: 4 }}
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
