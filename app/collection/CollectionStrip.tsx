"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { type Box } from "@/lib/data";

// Base card size. Cards grow TALLER as they pass through the horizontal
// center of the viewport, shrinking back toward the edges — a soft lens bulge.
const BASE_W = 130;
const BASE_H = 170;
const MAX_H = 360;          // height of a card dead-center
const FALLOFF = 520;        // px from center where the bulge fades to base
const GAP = 16;

function imgFor(box: Box, userPhotos: Record<number, string>): string {
  return userPhotos[box.id] ?? box.images?.[0] ?? "";
}

export default function CollectionStrip({
  boxes,
  onSelect,
  userPhotos = {},
}: {
  boxes: Box[];
  onSelect: (box: Box) => void;
  userPhotos?: Record<number, string>;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const rafRef = useRef<number | null>(null);

  // Recompute each card's height based on distance from the viewport center.
  const update = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;

    cardRefs.current.forEach((el) => {
      const r = el.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      // 1 at center → 0 at/after FALLOFF (smoothstep for a soft bulge)
      const t = Math.max(0, 1 - dist / FALLOFF);
      const eased = t * t * (3 - 2 * t);
      const h = BASE_H + (MAX_H - BASE_H) * eased;
      el.style.height = `${h}px`;
    });
  }, []);

  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      update();
    });
  }, [update]);

  useEffect(() => {
    update();
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [update, boxes]);

  // Translate vertical wheel into horizontal scroll so the strip feels natural.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    function onWheel(e: WheelEvent) {
      if (!scroller) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        scroller.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      style={{
        width: "100%",
        height: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        display: "flex",
        alignItems: "center",
        // generous side padding so the first/last cards can reach center
        paddingInline: "max(48px, calc(50vw - 360px))",
        gap: GAP,
        scrollbarWidth: "none",
      }}
      className="collection-strip"
    >
      {boxes.map((box) => {
        const src = imgFor(box, userPhotos);
        return (
          <div
            key={box.id}
            ref={(el) => {
              if (el) cardRefs.current.set(box.id, el);
              else cardRefs.current.delete(box.id);
            }}
            onClick={() => onSelect(box)}
            style={{
              flex: "0 0 auto",
              width: BASE_W,
              height: BASE_H,
              overflow: "hidden",
              cursor: "pointer",
              backgroundColor: "#E8E8E8",
              // height is animated via inline style in update(); ease it for
              // momentum smoothing between rAF frames
              transition: "height 0.12s linear",
              willChange: "height",
            }}
          >
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={box.title}
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(1.1)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
