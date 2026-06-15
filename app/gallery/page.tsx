"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { boxes, formatNeighbourhood, formatAddress, type Box, type Neighbourhood } from "@/lib/data";
import { DetailPanel } from "@/app/components/DetailPanel";
import { size, tracking, leading } from "@/lib/typography";
import { useNav } from "@/app/components/nav-context";
import { useAuth } from "@/app/components/auth-context";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Toast } from "@/app/components/Toast";

const StreetView = dynamic(() => import("./StreetView3D"), { ssr: false });

type ViewMode = "INDEX" | "PHOTOS";

// Tiny shared blur placeholder used by every <Image>. Paints instantly while
// the real (multi-hundred-KB) photo streams in.
const BLUR_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23E8E8E8"/></svg>';

// Cover photo. The gallery only shows boxes with at least one upload, so this
// always resolves to a real path; the empty-string fallback is just a guard.
function imgUrl(box: Box): string {
  return box.images?.[0] ?? "";
}



// ─── Index page ───────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [view, setView] = useState<ViewMode>("PHOTOS");
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [gridSelected, setGridSelected] = useState<Box | null>(null);
  const [photoColumns, setPhotoColumns] = useState(5);
  const prevColumns = useRef(5);

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;

  // Set initial columns based on screen width after mount
  useEffect(() => {
    if (window.innerWidth <= 640) {
      setPhotoColumns(2);
      prevColumns.current = 2;
    }
  }, []);
  const { setRight } = useNav();
  const { user, setCollectionCount } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState("");
  // Only show boxes that have at least one admin-uploaded photo.
  const hasUpload = (b: Box) => !!(b.images && b.images.length > 0);
  const [allBoxes, setAllBoxes] = useState<Box[]>(() => boxes.filter(hasUpload));
  const [boxesError, setBoxesError] = useState(false);
  const [activeNeighbourhoods, setActiveNeighbourhoods] = useState<Set<string>>(new Set());

  const neighbourhoods = useMemo(
    () => Array.from(new Set(allBoxes.map((b) => b.neighbourhood))).sort(),
    [allBoxes]
  );

  const hasActiveFilter = activeNeighbourhoods.size > 0;

  const filtered = hasActiveFilter
    ? allBoxes.filter((b) => activeNeighbourhoods.has(b.neighbourhood))
    : allBoxes;

  useEffect(() => {
    fetch("/api/boxes")
      .then((r) => r.json())
      .then((extra: Box[]) => {
        setAllBoxes([...boxes, ...extra].filter(hasUpload));
      })
      .catch(() => setBoxesError(true));
  }, []);

  useEffect(() => {
    if (!user) { setCollected(new Set()); return; }
    supabase
      .from("collections")
      .select("box_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setCollected(new Set(data.map((r) => r.box_id)));
      });
  }, [user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setGridSelected(null); return; }
      if (!gridSelected) return;
      const i = filtered.findIndex((b) => b.id === gridSelected.id);
      if (e.key === "ArrowLeft" && i > 0) setGridSelected(filtered[i - 1]);
      if (e.key === "ArrowRight" && i >= 0 && i < filtered.length - 1) setGridSelected(filtered[i + 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gridSelected, filtered]);

  useEffect(() => {
    if (isMobile) return;
    setRight(
      <GalleryControls
        view={view}
        onViewChange={setView}
        photoColumns={photoColumns}
        onColumnsChange={setPhotoColumns}
        prevColumnsRef={prevColumns}
        neighbourhoods={neighbourhoods}
        activeNeighbourhoods={activeNeighbourhoods}
        onNeighbourhoodsChange={setActiveNeighbourhoods}
      />
    );
    return () => setRight(null);
  }, [view, photoColumns, setRight, neighbourhoods, activeNeighbourhoods, isMobile]);

  async function toggleCollect(id: number) {
    if (!user) { router.push("/collection"); return; }
    const isCollected = collected.has(id);
    // Optimistic update
    setCollected((prev) => {
      const next = new Set(prev);
      if (isCollected) next.delete(id);
      else next.add(id);
      return next;
    });
    setCollectionCount((prev) => isCollected ? prev - 1 : prev + 1);
    const { error } = isCollected
      ? await supabase.from("collections").delete().match({ user_id: user.id, box_id: id })
      : await supabase.from("collections").insert({ user_id: user.id, box_id: id });
    if (error) {
      // Rollback optimistic update
      setCollected((prev) => {
        const next = new Set(prev);
        if (isCollected) next.add(id);
        else next.delete(id);
        return next;
      });
      setCollectionCount((prev) => isCollected ? prev + 1 : prev - 1);
      setToast("Couldn't update collection — try again");
    }
  }


  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: '"Geist", system-ui, sans-serif',
        color: "#202020",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <AnimatePresence>
        {toast && <Toast key={toast} message={toast} onDone={() => setToast("")} />}
      </AnimatePresence>
      {boxesError && (
        <div style={{ paddingInline: 12, paddingBlock: 6, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA", fontFamily: '"Geist", system-ui, sans-serif', borderBottom: "1px solid #F4F4F4" }}>
          Some boxes couldn't be loaded
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>
        {/* Filter empty state */}
        {filtered.length === 0 && hasActiveFilter && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: '"Geist", system-ui, sans-serif' }}>
            <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA" }}>
              No boxes match your filter
            </p>
          </div>
        )}
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? null : view === "INDEX" ? (
            <motion.div
              key="index"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ display: "flex", flex: 1, overflow: "hidden" }}
            >
              <IndexView
                boxes={filtered}
                collected={collected}
                onSelect={setGridSelected}
              />
            </motion.div>
          ) : (
            <motion.div
              key="photos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ display: "flex", flex: 1, overflow: "hidden" }}
            >
              <StreetView
                boxes={filtered}
                collected={collected}
                onCollect={toggleCollect}
                onSelect={setGridSelected}
                columns={photoColumns}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lightbox — centered modal over a blurred wash of the grid */}
      <AnimatePresence>
        {gridSelected && (
          <>
            {/* Backdrop: solid white wash — fixed so it covers the nav too. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setGridSelected(null)}
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "#FFFFFF",
                zIndex: 50,
                cursor: "default",
              }}
            />
            {/* Centered modal — full screen on mobile */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              className="lightbox-modal"
              style={{
                position: "fixed",
                zIndex: 51,
              }}
            >
              {(() => {
                const i = filtered.findIndex((b) => b.id === gridSelected.id);
                return (
                  <DetailPanel
                    box={gridSelected}
                    displayNumber={i + 1}
                    isCollected={collected.has(gridSelected.id)}
                    onCollect={() => toggleCollect(gridSelected.id)}
                    onPrev={() => { if (i > 0) setGridSelected(filtered[i - 1]); }}
                    onNext={() => { if (i >= 0 && i < filtered.length - 1) setGridSelected(filtered[i + 1]); }}
                    hasPrev={i > 0}
                    hasNext={i >= 0 && i < filtered.length - 1}
                    onClose={() => setGridSelected(null)}
                  />
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Index view ───────────────────────────────────────────────────────────────

// ─── Motion depth stack (fixed, viewport-centered) ────────────────────────────

// Portrait-leaning 4:5 frame with object-fit: cover — full-bleed, no bars.
// Favours portrait photos (most of the set); landscape crops to the center.
const STACK_W = 340, STACK_H = 425;

// Tunable knobs for the stack geometry. Defaults match the baked-in look;
// the dial kit (DepthStackDials) overrides these live.
export type StackParams = {
  spacing: number;   // px gap between each stacked card (peek)
  blurStep: number;  // px of blur added per depth level
  exitBlur: number;  // px of blur on a card as it fades out (item swap)
};

export const DEFAULT_STACK_PARAMS: StackParams = { spacing: 30, blurStep: 2, exitBlur: 50 };

// Geometry per depth slot. index 0 = front (large, sharp), higher = receding.
// Anchored from the top so each card's top edge peeks a fixed gap above the
// one in front; the shrink pulls the bottom up and never hides the peek.
function slotGeo(i: number, p: StackParams) {
  return {
    y: -i * p.spacing,                          // gap above the front card
    scale: 1 - i * 0.08,                        // 1, .92, .84, .76 — recede
    blur: i === 0 ? 0 : p.blurStep + (i - 1) * p.blurStep, // 0, step, 2·step…
    opacity: 1 - i * 0.12,                      // 1, .88, .76, .64
  };
}

// A single card. Keyed by image, so when the hovered item changes, motion
// slides each surviving card forward one depth slot (the `layout` animation).
// A newly added card simply fades in AT its back slot — no flying in from above.
// The front card fades + blurs out as it leaves.
function StackCard({ src, depth, params, spring }: { src: string; depth: number; params: StackParams; spring: object }) {
  const g = slotGeo(depth, params);
  return (
    <motion.div
      // Position animated via `y` (not layout), so a new card starts AT its own
      // slot + a tiny 8px rise — never flashing high. Surviving cards animate
      // their y from the old slot to the new one as depth changes.
      initial={{ opacity: 0, y: g.y + 8, boxShadow: "0 12px 48px rgba(0,0,0,0)", filter: `blur(${g.blur}px)` }}
      animate={{
        opacity: g.opacity,
        y: g.y,
        scale: g.scale,
        filter: `blur(${g.blur}px)`,
        // Only the front card carries a shadow; it fades in/out with the card.
        boxShadow: depth === 0 ? "0 12px 48px rgba(0,0,0,0.16)" : "0 12px 48px rgba(0,0,0,0)",
      }}
      exit={{
        opacity: 0,
        // fade the shadow to nothing + a touch of blur as the card leaves
        boxShadow: "0 12px 48px rgba(0,0,0,0)",
        filter: `blur(${g.blur + 6}px)`,
        transition: { duration: 0.3, ease: "easeOut" },
      }}
      transition={{
        y: spring,
        scale: spring,
        opacity: { duration: 0.3, ease: "easeOut" },
        boxShadow: { duration: 0.3, ease: "easeOut" },
        filter: { duration: 0.3, ease: "easeOut" },
      }}
      style={{
        position: "absolute",
        width: STACK_W,
        height: STACK_H,
        left: 0,
        top: 0,
        transformOrigin: "center top",
        zIndex: 10 - depth,
        overflow: "hidden",
        backgroundColor: "#E8E8E8",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(1.1)" }} />
    </motion.div>
  );
}

function DepthStack({ srcs, visible, params, spring }: { srcs: string[]; visible: boolean; params: StackParams; spring: object }) {
  const cards = srcs.slice(0, 4);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: STACK_W,
            height: STACK_H,
            pointerEvents: "none",
            zIndex: 40,
          }}
        >
          {/* Keyed by image so motion slides each surviving card forward a slot
              when the item changes; the new card fades in at the back slot. */}
          <AnimatePresence mode="popLayout">
            {cards.map((src, depth) => (
              <StackCard key={src} src={src} depth={depth} params={params} spring={spring} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IndexView({
  boxes,
  collected,
  onSelect,
}: {
  boxes: Box[];
  collected: Set<number>;
  onSelect: (b: Box) => void;
}) {
  const [hovered, setHovered] = useState<Box | null>(null);
  const hoveredIndex = hovered ? boxes.findIndex(b => b.id === hovered.id) : -1;
  const containerRef = useRef<HTMLDivElement>(null);

  // Depth-stack geometry + the spring that settles cards as they shift slots.
  const stackParams = DEFAULT_STACK_PARAMS;
  const stackSpring = { type: "spring" as const, visualDuration: 0.32, bounce: 0 };

  // front = hovered box, then next 3 boxes looping
  const srcs = useMemo(() => {
    if (hoveredIndex < 0 || boxes.length === 0) return [];
    return Array.from({ length: 4 }, (_, i) => {
      const idx = (hoveredIndex + i) % boxes.length;
      return boxes[idx]?.images?.[0] ?? "";
    }).filter(Boolean);
  }, [hoveredIndex, boxes]);

  // Track each row's geometry so the shared highlight bar can slide to it.
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [highlight, setHighlight] = useState<{ top: number; height: number } | null>(null);

  function handleHover(box: Box) {
    setHovered(box);
    const el = rowRefs.current.get(box.id);
    const container = containerRef.current;
    if (el && container) {
      setHighlight({ top: el.offsetTop, height: el.offsetHeight });
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseLeave={() => { setHovered(null); }}
      style={{
        flex: 1,
        position: "relative",
        overflowY: "auto",
        paddingTop: 24,
        paddingInline: 32,
      }}
    >
      <DepthStack srcs={srcs} visible={hovered !== null} params={stackParams} spring={stackSpring} />

      {/* Shared sliding highlight — spans full viewport width, follows the
          hovered row instead of re-rendering per row. */}
      <AnimatePresence>
        {hovered && highlight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, top: highlight.top, height: highlight.height }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.15 },
              top: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
              height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
            }}
            style={{
              position: "absolute",
              // extend past the 32px container padding to reach the viewport edges
              left: -32,
              right: -32,
              top: highlight.top,
              height: highlight.height,
              backgroundColor: "#F7F7F7",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {boxes.map((box, i) => (
        <motion.div
          key={box.id}
          ref={(el) => {
            if (el) rowRefs.current.set(box.id, el);
            else rowRefs.current.delete(box.id);
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, delay: i * 0.035, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <IndexRow
            box={box}
            displayNumber={i + 1}
            isSelected={false}
            isDimmed={hovered !== null && hovered.id !== box.id}
            isCollected={collected.has(box.id)}
            isHovered={hovered?.id === box.id}
            onSelect={() => onSelect(box)}
            onMouseEnter={() => handleHover(box)}
            onMouseLeave={() => {}}
          />
        </motion.div>
      ))}
      <div style={{ paddingTop: 40, paddingBottom: 24, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#202020" }}>
        Last updated June 1, 2026 · {boxes.length} boxes
      </div>
    </div>
  );
}

function IndexRow({
  box,
  displayNumber,
  isSelected,
  isDimmed,
  isCollected,
  isHovered,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: {
  box: Box;
  displayNumber: number;
  isSelected: boolean;
  isDimmed: boolean;
  isCollected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const textColor = isDimmed ? "#D3D3D3" : "#202020";
  const transition = "color 200ms ease";

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="index-row index-row-btn"
      style={{
        display: "flex",
        alignItems: "center",
        paddingBlock: 10,
        paddingInline: 0,
        background: "none",
        border: "none",
        borderBottom: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        fontFamily: "inherit",
        fontWeight: 400,
        position: "relative",
      }}
    >
      {/* Left group: (number) TITLE */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: "0 0 auto" }}>
        <span style={{ flexShrink: 0, fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label, textTransform: "uppercase", color: textColor, transition }}>
          ({String(displayNumber).padStart(2, "0")})
        </span>
        <span style={{ fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label, textTransform: "uppercase", color: textColor, transition }}>
          {box.title}
        </span>
      </div>

      {/* Spacer — the global fixed stack floats over this area */}
      <div style={{ flex: 1 }} />

      {/* Right group: ARTIST · NEIGHBOURHOOD — adjacent, flush right */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
        <span className="index-col" style={{ fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label, textTransform: "uppercase", color: textColor, transition }}>
          {box.artist}
        </span>
        {/* Dot separator — floats between artist and neighbourhood */}
        <span style={{ width: 3, height: 3, borderRadius: "50%", flexShrink: 0, backgroundColor: textColor, display: "inline-block", transition }} />
        <span className="index-col" style={{ fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label, textTransform: "uppercase", color: textColor, transition }}>
          {formatNeighbourhood(box.neighbourhood)}
        </span>
      </div>

      {/* Mobile thumbnail */}
      {box.images?.[0] && (
        <div className="index-thumb" style={{ display: "none", width: 48, height: 48, flexShrink: 0, overflow: "hidden", marginLeft: 12 }}>
          <Image src={box.images[0]} alt={box.title} width={48} height={48} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
    </button>
  );
}


// ─── ClearButton ──────────────────────────────────────────────────────────────

function ClearButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={enabled ? onClick : undefined}
      onMouseEnter={() => enabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding: "5px 12px", background: "none", border: "none",
        cursor: enabled ? "pointer" : "default", textAlign: "left", fontFamily: "inherit",
        fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase",
        color: enabled ? (hovered ? "#202020" : "#A8A8A8") : "#D8D8D8",
        transition: "color 0.12s ease",
      }}
    >
      Clear
    </button>
  );
}

// ─── HoverBtn ─────────────────────────────────────────────────────────────────

const HoverBtn = React.forwardRef<HTMLButtonElement, {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
}>(function HoverBtn({ children, onClick, active, className }, ref) {
  const [hovered, setHovered] = useState(false);
  const color = active || hovered ? "#202020" : "#A8A8A8";
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "none", border: "none", outline: "none", cursor: "pointer",
        padding: 0, fontFamily: "inherit",
        fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label,
        textTransform: "uppercase", color, transition: "color 0.12s ease", fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
});

// ─── GalleryControls ──────────────────────────────────────────────────────────

function GalleryControls({
  view, onViewChange, photoColumns, onColumnsChange, prevColumnsRef,
  neighbourhoods, activeNeighbourhoods, onNeighbourhoodsChange,
}: {
  view: "INDEX" | "PHOTOS";
  onViewChange: (v: "INDEX" | "PHOTOS") => void;
  photoColumns: number;
  onColumnsChange: (n: number) => void;
  prevColumnsRef: React.MutableRefObject<number>;
  neighbourhoods: string[];
  activeNeighbourhoods: Set<string>;
  onNeighbourhoodsChange: (s: Set<string>) => void;
}) {
  const [showFilter, setShowFilter] = useState(false);
  // Direction of the last column change: +1 = increased (slide up), -1 = decreased.
  // Stored in state so the entering and exiting digit agree on direction.
  const [colDir, setColDir] = useState(1);
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showFilter) return;
    let raf: number;
    function track() {
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setFilterPos({ top: r.bottom + 12, left: r.left });
      }
      raf = requestAnimationFrame(track);
    }
    raf = requestAnimationFrame(track);
    return () => cancelAnimationFrame(raf);
  }, [showFilter]);

  function toggle(n: string) {
    const next = new Set(activeNeighbourhoods);
    if (next.has(n)) next.delete(n); else next.add(n);
    onNeighbourhoodsChange(next);
  }

  useEffect(() => {
    if (!showFilter) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowFilter(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [showFilter]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {(["PHOTOS", "INDEX"] as const).map((v) => (
          <HoverBtn key={v} onClick={() => onViewChange(v)} active={view === v}>
            [{v === "PHOTOS" ? "GRID" : v}]
          </HoverBtn>
        ))}

        <AnimatePresence>
          {view === "PHOTOS" && (
            <motion.div key="slider" className="nav-slider" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }} style={{ overflow: "hidden", display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 14, borderLeft: "1px solid #E8E8E8" }}>
                <input type="range" className="col-slider" min={2} max={6} value={photoColumns}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (next === photoColumns) return;
                    setColDir(next > photoColumns ? 1 : -1);
                    prevColumnsRef.current = photoColumns;
                    onColumnsChange(next);
                  }}
                />
                <span style={{ display: "inline-block", width: 10, height: 16, overflow: "hidden", position: "relative", verticalAlign: "middle" }}>
                  <AnimatePresence mode="popLayout" initial={false} custom={colDir}>
                    <motion.span
                      key={photoColumns}
                      custom={colDir}
                      variants={{
                        enter: (dir: number) => ({ y: dir > 0 ? "100%" : "-100%" }),
                        center: { y: "0%" },
                        exit: (dir: number) => ({ y: dir > 0 ? "-100%" : "100%" }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ display: "block", fontSize: size.meta, lineHeight: "16px", letterSpacing: tracking.normal, color: "#202020", fontFamily: "inherit", textAlign: "center" }}
                    >
                      {photoColumns}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="nav-divider" style={{ width: 1, height: 12, background: "#E8E8E8" }} />
        <HoverBtn
          ref={btnRef}
          className="nav-filter"
          onClick={() => setShowFilter((s) => !s)}
          active={activeNeighbourhoods.size > 0 || showFilter}
        >
          [Filter]
        </HoverBtn>
      </div>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {showFilter && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                position: "fixed",
                top: filterPos?.top ?? 44,
                left: filterPos ? filterPos.left : "50%",
                zIndex: 200,
                background: "#FFFFFF",
                border: "1px solid #E8E8E8",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                padding: "6px 0",
                minWidth: 160,
                fontFamily: '"Geist", system-ui, sans-serif',
              }}
            >
              <div style={{ padding: "4px 12px 6px", fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>Neighbourhood</div>
              {neighbourhoods.map((n) => {
                const checked = activeNeighbourhoods.has(n);
                return (
                  <button key={n} onClick={() => toggle(n)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: size.meta, letterSpacing: tracking.normal, color: checked ? "#202020" : "#606060", transition: "color 0.12s ease" }}
                  >
                    <span style={{ width: 13, height: 13, border: `1px solid ${checked ? "#202020" : "#D0D0D0"}`, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: checked ? "#202020" : "transparent", transition: "all 0.12s ease" }}>
                      {checked && (
                        <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
                          <path d="M1 3L2.8 5L6 1" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {formatNeighbourhood(n)}
                  </button>
                );
              })}
              <div style={{ height: 1, background: "#F0F0F0", margin: "4px 0" }} />
              <ClearButton
                enabled={activeNeighbourhoods.size > 0}
                onClick={() => { onNeighbourhoodsChange(new Set()); setShowFilter(false); }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
