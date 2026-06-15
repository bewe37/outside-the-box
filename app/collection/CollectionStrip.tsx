"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { type Box } from "@/lib/data";

// Each card takes its photo's true aspect ratio. A common BASE_H sets the
// resting height; width follows from the image's natural ratio (so landscape
// cards are wide, portrait cards narrow). Cards SCALE UP as they pass through
// the horizontal center of the viewport — a soft lens bulge that works for
// any orientation.
const BASE_H = 190;       // resting height of every card
const MAX_SCALE = 1.9;    // scale of a card dead-center
const FALLOFF = 520;      // px from center where the bulge fades to base
const GAP = 16;
const FALLBACK_RATIO = 0.75; // assumed portrait until the image loads

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

  // box.id → aspect ratio (w/h). Loaded lazily; portrait assumed meanwhile.
  const [ratios, setRatios] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    boxes.forEach((box) => {
      if (ratios.has(box.id)) return;
      const src = imgFor(box, userPhotos);
      if (!src) return;
      const img = new window.Image();
      img.onload = () => {
        if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
        setRatios((prev) => {
          if (prev.has(box.id)) return prev;
          return new Map(prev).set(box.id, img.naturalWidth / img.naturalHeight);
        });
      };
      img.src = src;
    });
    return () => { cancelled = true; };
  }, [boxes, userPhotos, ratios]);

  // Scale each card by distance from the viewport center.
  const update = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;

    cardRefs.current.forEach((el) => {
      const r = el.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      const t = Math.max(0, 1 - dist / FALLOFF);
      const eased = t * t * (3 - 2 * t);            // smoothstep
      const scale = 1 + (MAX_SCALE - 1) * eased;
      el.style.transform = `scale(${scale})`;
      el.style.zIndex = String(Math.round(eased * 100));
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
  }, [update, boxes, ratios]);

  // Vertical wheel → horizontal scroll.
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
      className="collection-strip"
      style={{
        width: "100%",
        height: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        display: "flex",
        alignItems: "center",
        paddingInline: "max(48px, calc(50vw - 360px))",
        // extra vertical room so scaled-up cards aren't clipped
        paddingBlock: 80,
        gap: GAP,
        scrollbarWidth: "none",
      }}
    >
      {boxes.map((box) => {
        const src = imgFor(box, userPhotos);
        const ratio = ratios.get(box.id) ?? FALLBACK_RATIO;
        const width = Math.round(BASE_H * ratio);
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
              width,
              height: BASE_H,
              overflow: "hidden",
              cursor: "pointer",
              backgroundColor: "#E8E8E8",
              transformOrigin: "center center",
              transition: "transform 0.12s linear",
              willChange: "transform",
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
