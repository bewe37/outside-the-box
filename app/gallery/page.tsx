"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { boxes, NEIGHBOURHOODS, type Box, type Neighbourhood } from "@/lib/data";
import { SiteNav } from "@/app/components/site-nav";
import gsap from "gsap";

const GridView = dynamic(() => import("./GridView3D"), { ssr: false });
const StreetView = dynamic(() => import("./StreetView3D"), { ssr: false });

type ViewMode = "INDEX" | "GRID" | "PHOTOS";

function imgUrl(box: Box, w: number, h: number): string {
  if (box.images && box.images.length > 0) return box.images[0];
  return `https://picsum.photos/seed/box${box.id}/${w}/${h}`;
}

function isUploaded(box: Box): boolean {
  return !!(box.images && box.images.length > 0);
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({
  view,
  onViewChange,
  collectedCount,
  photoColumns,
  onColumnsChange,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  collectedCount: number;
  photoColumns: number;
  onColumnsChange: (n: number) => void;
}) {
  const viewControls = (
    <>
      {(["GRID", "INDEX", "PHOTOS"] as ViewMode[]).map((v) => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
        >
          {view === v && (
            <span style={{ width: 4, height: 8, borderRadius: 1, backgroundColor: "#202020", flexShrink: 0, display: "inline-block" }} />
          )}
          <span style={{ fontSize: 11, letterSpacing: "-0.04em", fontWeight: 500, textTransform: "uppercase", color: view === v ? "#202020" : "#A8A8A8", lineHeight: "14px" }}>
            {v}
          </span>
        </button>
      ))}

      {view === "PHOTOS" && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 14, borderLeft: "1px solid #E8E8E8", marginLeft: 2 }}>
          <input
            type="range"
            className="col-slider"
            min={2}
            max={6}
            value={photoColumns}
            onChange={(e) => onColumnsChange(Number(e.target.value))}
          />
          <span style={{ fontSize: 11, letterSpacing: "-0.04em", fontWeight: 500, color: "#202020", lineHeight: "14px", minWidth: 10, fontFamily: "inherit" }}>
            {photoColumns}
          </span>
        </div>
      )}
    </>
  );

  return (
    <SiteNav
      collectedCount={collectedCount}
      right={viewControls}
      borderBottom={view === "GRID"}
    />
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  active,
  onChange,
}: {
  active: Neighbourhood | "ALL";
  onChange: (n: Neighbourhood | "ALL") => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        paddingInline: 16,
        borderTop: "1px solid #D3D3D3",
        borderBottom: "1px solid #D3D3D3",
        flexShrink: 0,
      }}
    >
      {/* Label */}
      <div
        style={{
          marginRight: 20,
          flexShrink: 0,
          paddingTop: 11,
          paddingRight: 16,
          paddingBottom: 11,
          borderRight: "1px solid #D3D3D3",
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: "-0.04em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: "#202020",
            lineHeight: "14px",
          }}
        >
          Neighbourhood
        </span>
      </div>

      {/* Pills */}
      <div style={{ display: "flex", gap: 4 }}>
        {(["ALL", ...NEIGHBOURHOODS] as const).map((n) => {
          const isActive = active === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              style={{
                fontSize: 11,
                letterSpacing: "-0.04em",
                fontWeight: 500,
                textTransform: "uppercase",
                lineHeight: "14px",
                paddingBlock: 5,
                paddingInline: 10,
                borderRadius: 2,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                backgroundColor: isActive ? "#202020" : "transparent",
                color: isActive ? "#FFFFFF" : "#202020",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Index page ───────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [view, setView] = useState<ViewMode>("PHOTOS");
  const [filter, setFilter] = useState<Neighbourhood | "ALL">("ALL");
  const [selected, setSelected] = useState<Box | null>(null);
  const [hovered, setHovered] = useState<Box | null>(null);
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [gridSelected, setGridSelected] = useState<Box | null>(null);
  const [photoColumns, setPhotoColumns] = useState(3);
  const [allBoxes, setAllBoxes] = useState<Box[]>(boxes);

  useEffect(() => {
    fetch("/api/boxes")
      .then((r) => r.json())
      .then((extra: Box[]) => {
        if (extra.length > 0) setAllBoxes([...boxes, ...extra]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("otb_collected");
      if (stored) setCollected(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setGridSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollect(id: number) {
    setCollected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("otb_collected", JSON.stringify([...next]));
      return next;
    });
  }

  const filtered = filter === "ALL" ? allBoxes : allBoxes.filter((b) => b.neighbourhood === filter);

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
      <Nav view={view} onViewChange={setView} collectedCount={collected.size} photoColumns={photoColumns} onColumnsChange={setPhotoColumns} />
      <AnimatePresence>
        {(view === "INDEX" || view === "PHOTOS") && (
          <motion.div
            key="filterbar"
            variants={{
              hidden: { opacity: 0, y: -6 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] } },
              exit:    { opacity: 0, y: -6, transition: { duration: 0.12, ease: [0.25, 0.1, 0.25, 1] } },
            }}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <FilterBar active={filter} onChange={(n) => { setFilter(n); setSelected(null); }} />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>
        <AnimatePresence mode="wait">
          {view === "INDEX" ? (
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
                selected={selected}
                hovered={hovered}
                collected={collected}
                onSelect={(b) => setSelected(selected?.id === b.id ? null : b)}
                onHover={setHovered}
                onCollect={toggleCollect}
              />
            </motion.div>
          ) : view === "GRID" ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ display: "flex", flex: 1, overflow: "hidden" }}
            >
              <GridView
                boxes={filtered}
                collected={collected}
                onCollect={toggleCollect}
                onGridSelect={setGridSelected}
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

      {/* Grid detail panel — overlays entire page including nav */}
      <AnimatePresence>
        {gridSelected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setGridSelected(null)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.18)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                zIndex: 20,
                cursor: "default",
              }}
            />
            <motion.div
              key={gridSelected.id}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: 900,
                backgroundColor: "#FFFFFF",
                borderLeft: "1px solid #D3D3D3",
                zIndex: 21,
                overflow: "hidden",
                willChange: "transform",
                display: "flex",
              }}
            >
              <DetailPanel
                box={gridSelected}
                isCollected={collected.has(gridSelected.id)}
                onCollect={() => toggleCollect(gridSelected.id)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Index view ───────────────────────────────────────────────────────────────

function IndexView({
  boxes,
  selected,
  hovered,
  collected,
  onSelect,
  onHover,
  onCollect,
}: {
  boxes: Box[];
  selected: Box | null;
  hovered: Box | null;
  collected: Set<number>;
  onSelect: (b: Box) => void;
  onHover: (b: Box | null) => void;
  onCollect: (id: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [hoverY, setHoverY] = useState(0);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* List — fixed 1018px */}
      <div
        style={{
          width: 1018,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          paddingTop: 8,
        }}
      >
        {boxes.map((box, i) => (
          <motion.div
            key={box.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, delay: i * 0.035, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ width: "100%" }}
          >
            <IndexRow
              box={box}
              isSelected={selected?.id === box.id}
              isDimmed={(() => { const focusId = selected?.id ?? hovered?.id ?? null; return focusId !== null && focusId !== box.id; })()}
              isCollected={collected.has(box.id)}
              onSelect={() => onSelect(box)}
              onMouseEnter={(e) => {
                onHover(box);
                if (panelRef.current) {
                  const rowRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const panelRect = panelRef.current.getBoundingClientRect();
                  setHoverY(rowRect.top - panelRect.top);
                }
              }}
              onMouseLeave={() => onHover(null)}
            />
          </motion.div>
        ))}
      </div>

      {/* Detail panel — grows to fill remaining space */}
      <div
        ref={panelRef}
        style={{
          flex: 1,
          borderLeft: "1px solid #D3D3D3",
          position: "relative",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ display: "flex", flex: 1, willChange: "transform, opacity" }}
            >
              <DetailPanel
                box={selected}
                isCollected={collected.has(selected.id)}
                onCollect={() => onCollect(selected.id)}
              />
            </motion.div>
          ) : hovered ? (
            <motion.div
              key={`hover-${hovered.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "absolute",
                left: 25,
                top: hoverY,
                width: 132,
                height: 200,
                overflow: "hidden",
                pointerEvents: "none",
                willChange: "opacity",
              }}
            >
              <Image
                src={imgUrl(hovered, 264, 400)}
                alt={hovered.title}
                fill
                style={{ objectFit: "cover" }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function IndexRow({
  box,
  isSelected,
  isDimmed,
  isCollected,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: {
  box: Box;
  isSelected: boolean;
  isDimmed: boolean;
  isCollected: boolean;
  onSelect: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  const textColor = isDimmed ? "#D3D3D3" : "#202020";
  const transition = "color 200ms ease";

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: "flex",
        alignItems: "center",
        paddingBlock: 8,
        paddingInline: 0,
        background: "none",
        border: "none",
        borderBottom: "1px solid #F0F0F0",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        fontFamily: "inherit",
      }}
    >
      {/* Number + Title — 400px */}
      <div style={{ width: 400, flexShrink: 0, display: "flex", paddingLeft: 16 }}>
        <span
          style={{
            width: 44,
            flexShrink: 0,
            fontSize: 11,
            letterSpacing: "-0.04em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: textColor,
            lineHeight: "14px",
            transition,
          }}
        >
          ({String(box.id).padStart(3, "0")})
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "-0.04em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: textColor,
            lineHeight: "14px",
            transition,
          }}
        >
          {box.title}
        </span>
      </div>

      {/* Address — 280px */}
      <span
        style={{
          width: 280,
          flexShrink: 0,
          fontSize: 11,
          letterSpacing: "-0.04em",
          fontWeight: 500,
          textTransform: "uppercase",
          color: textColor,
          lineHeight: "14px",
          transition,
        }}
      >
        {box.address}
      </span>

      {/* Neighbourhood — 220px */}
      <span
        style={{
          width: 220,
          flexShrink: 0,
          fontSize: 13,
          letterSpacing: "-0.06em",
          fontWeight: 500,
          textTransform: "uppercase",
          color: textColor,
          lineHeight: "16px",
          transition,
        }}
      >
        {box.neighbourhood}
      </span>

      {/* Collected dot */}
      <span
        style={{
          marginLeft: "auto",
          marginRight: 16,
          width: 5,
          height: 5,
          borderRadius: "50%",
          flexShrink: 0,
          backgroundColor: isCollected ? "#202020" : "transparent",
          display: "inline-block",
          transition,
        }}
      />
    </button>
  );
}

// ─── Stamp ────────────────────────────────────────────────────────────────────

const NEIGHBOURHOOD_STAMPS: Record<Neighbourhood, string> = {
  "LESLIEVILLE":       "/Yonge.svg",
  "PARKDALE":          "/Dufferin.svg",
  "KENSINGTON":        "/Kensington.svg",
  "TRINITY BELLWOODS": "/TrinityBellwoods.svg",
  "RIVERSIDE":         "/Harbourfront.svg",
  "CORK TOWN":         "/CabbageTown.svg",
  "THE ANNEX":         "/Annex.svg",
};

const NEIGHBOURHOOD_ROTATION: Record<Neighbourhood, number> = {
  "LESLIEVILLE":       -2,
  "PARKDALE":           1.5,
  "KENSINGTON":        -1.5,
  "TRINITY BELLWOODS":  2,
  "RIVERSIDE":         -1,
  "CORK TOWN":          1,
  "THE ANNEX":         -2.5,
};

// ─── Stamp lightbox ───────────────────────────────────────────────────────────

function StampLightbox({
  neighbourhood,
  onClose,
}: {
  neighbourhood: Neighbourhood;
  onClose: () => void;
}) {
  const cardRef  = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const src = NEIGHBOURHOOD_STAMPS[neighbourhood];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card  = cardRef.current;
    const shine = shineRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;

    gsap.to(card, {
      rotateX: -y * 18,
      rotateY:  x * 18,
      transformPerspective: 1000,
      duration: 0.2,
      ease: "power2.out",
    });

    if (shine) {
      gsap.to(shine, {
        x: x * rect.width  * 0.6,
        y: y * rect.height * 0.6,
        opacity: 0.7,
        duration: 0.15,
        ease: "power2.out",
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      gsap.to(cardRef.current, { rotateX: 0, rotateY: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
    }
    if (shineRef.current) {
      gsap.to(shineRef.current, { opacity: 0, duration: 0.3 });
    }
  }, []);

  return createPortal(
    <motion.div
      key="lightbox-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.42)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <motion.div
        key="lightbox-card"
        initial={{ scale: 0.82, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: "default", transformStyle: "preserve-3d" }}
      >
        {/* Card — warm paper */}
        <div
          ref={cardRef}
          style={{
            background: "#F7F2E8",
            backgroundImage: [
              "radial-gradient(ellipse at 30% 25%, rgba(255,245,210,0.7) 0%, transparent 55%)",
              "radial-gradient(ellipse at 75% 80%, rgba(210,200,180,0.35) 0%, transparent 50%)",
            ].join(", "),
            borderRadius: 6,
            padding: "40px 40px 30px",
            boxShadow: "0 28px 72px rgba(0,0,0,0.22), 0 2px 10px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
            transformStyle: "preserve-3d",
            transformOrigin: "center center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Paper grain */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              opacity: 0.055,
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />

          {/* Shine */}
          <div
            ref={shineRef}
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at center, rgba(255,255,255,0.7) 0%, transparent 60%)",
              opacity: 0,
              pointerEvents: "none",
              mixBlendMode: "overlay",
            }}
          />

          {/* Stamp */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${neighbourhood} stamp`}
            style={{
              display: "block",
              width: 380,
              height: 380,
              objectFit: "contain",
              transform: `rotate(${NEIGHBOURHOOD_ROTATION[neighbourhood]}deg)`,
            }}
          />

          {/* Neighbourhood label */}
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#AAAAAA",
              fontFamily: '"Geist", system-ui, sans-serif',
            }}
          >
            {neighbourhood}
          </div>
        </div>

        {/* Hint */}
        <div
          style={{
            marginTop: 14,
            textAlign: "center",
            fontSize: 10,
            letterSpacing: "0.06em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.35)",
            fontFamily: '"Geist", system-ui, sans-serif',
          }}
        >
          Click outside to close
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ─── Stamp (detail panel) ─────────────────────────────────────────────────────

function Stamp({
  neighbourhood,
  isCollected,
  size = 140,
}: {
  neighbourhood: Neighbourhood;
  isCollected: boolean;
  size?: number;
}) {
  const stampRef      = useRef<HTMLDivElement>(null);
  const shadowRef     = useRef<HTMLDivElement>(null);
  const tiltRef       = useRef<HTMLDivElement>(null);
  const inShineRef    = useRef<HTMLDivElement>(null);
  const prevCollected = useRef<boolean | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleTiltMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCollected) return;
    const el = tiltRef.current;
    const shine = inShineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    gsap.to(el, { rotateX: -y * 14, rotateY: x * 14, transformPerspective: 600, duration: 0.2, ease: "power2.out" });
    if (shine) gsap.to(shine, { x: x * size * 0.5, y: y * size * 0.5, opacity: 0.65, duration: 0.15, ease: "power2.out" });
  }, [isCollected, size]);

  const handleTiltLeave = useCallback(() => {
    if (tiltRef.current) gsap.to(tiltRef.current, { rotateX: 0, rotateY: 0, duration: 0.7, ease: "elastic.out(1, 0.5)" });
    if (inShineRef.current) gsap.to(inShineRef.current, { opacity: 0, duration: 0.3 });
  }, []);

  useEffect(() => {
    const el     = stampRef.current;
    const shadow = shadowRef.current;
    if (!el) return;

    const rot = NEIGHBOURHOOD_ROTATION[neighbourhood];

    if (isCollected) {
      const justCollected = prevCollected.current === false;
      gsap.killTweensOf([el, shadow]);

      if (justCollected) {
        const tl = gsap.timeline();
        tl.set(el, { y: -80, scaleX: 1, scaleY: 1, opacity: 0, rotation: rot + 5 })
          .to(el, { y: 0, rotation: rot, duration: 0.18, ease: "power4.in" })
          .set(el, { opacity: 1, scaleX: 1.1, scaleY: 0.82 })
          .to(el, { scaleX: 1, scaleY: 1, duration: 0.55, ease: "elastic.out(1.1, 0.45)" });

        if (shadow) {
          gsap.set(shadow, { scale: 0.75, opacity: 0.5 });
          gsap.to(shadow, { scale: 1.6, opacity: 0, duration: 0.45, ease: "power2.out", delay: 0.18 });
        }
      } else {
        gsap.set(el, { opacity: 0, y: 6, scale: 0.9, rotation: rot });
        gsap.to(el, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.6)" });
      }
    } else {
      gsap.to(el, {
        y: -20, opacity: 0, scale: 0.88,
        rotation: NEIGHBOURHOOD_ROTATION[neighbourhood] - 6,
        duration: 0.22, ease: "power2.in",
      });
    }

    prevCollected.current = isCollected;
  }, [isCollected, neighbourhood]);

  const src = NEIGHBOURHOOD_STAMPS[neighbourhood];
  const rot = NEIGHBOURHOOD_ROTATION[neighbourhood];

  return (
    <>
      {/* Outer: tilt container */}
      <div
        ref={tiltRef}
        onMouseMove={handleTiltMove}
        onMouseLeave={handleTiltLeave}
        onClick={() => isCollected && setLightboxOpen(true)}
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
          overflow: "visible",
          cursor: isCollected ? "zoom-in" : "default",
          transformStyle: "preserve-3d",
          transformOrigin: "center center",
        }}
      >
        {/* Impact shadow */}
        <div
          ref={shadowRef}
          style={{
            position: "absolute",
            bottom: -6,
            left: "10%",
            right: "10%",
            height: 12,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.18)",
            filter: "blur(6px)",
            opacity: 0,
            pointerEvents: "none",
          }}
        />

        {/* Stamp */}
        <div
          ref={stampRef}
          style={{
            opacity: 0,
            width: size,
            height: size,
            transformOrigin: "center bottom",
            transform: `rotate(${rot}deg)`,
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${neighbourhood} stamp`}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
          />

          {/* In-page tilt shine */}
          <div
            ref={inShineRef}
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at center, rgba(255,255,255,0.5) 0%, transparent 65%)",
              opacity: 0,
              pointerEvents: "none",
              mixBlendMode: "overlay",
            }}
          />
        </div>
      </div>

      <AnimatePresence>
        {lightboxOpen && (
          <StampLightbox
            key="stamp-lightbox"
            neighbourhood={neighbourhood}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  box,
  isCollected,
  onCollect,
}: {
  box: Box;
  isCollected: boolean;
  onCollect: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Reset active photo when box changes
  useEffect(() => { setActiveIdx(0); }, [box.id]);

  const hasRealPhotos = isUploaded(box);
  const photos = hasRealPhotos ? box.images! : null;
  const activePhotoSrc = hasRealPhotos
    ? photos![activeIdx] ?? photos![0]
    : imgUrl(box, 800, 1000);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 60,
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 40,
        paddingLeft: 16,
        flex: 1,
        overflow: "hidden",
      }}
    >
      {/* Metadata column */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          flexGrow: 0,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Caption */}
        <span
          style={{
            fontSize: 10,
            letterSpacing: "-0.02em",
            fontWeight: 500,
            marginBottom: 10,
            color: "#AAAAAA",
            lineHeight: "14px",
            fontFamily: '"Geist", system-ui, sans-serif',
          }}
        >
          ({String(box.id).padStart(3, "0")}) CAPTURED {box.captured}
        </span>

        {/* Inner column — space-between */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flex: 1,
            justifyContent: "space-between",
          }}
        >
          {/* Title + stamp */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <span
              style={{
                fontSize: 22,
                lineHeight: "28px",
                letterSpacing: "-0.05em",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "#202020",
                fontFamily: '"Geist", system-ui, sans-serif',
                display: "block",
              }}
            >
              {box.title}
            </span>
            <Stamp neighbourhood={box.neighbourhood} isCollected={isCollected} size={200} />
          </div>

          {/* Bottom section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Artist" value={box.artist} />
              <Field label="Year" value={String(box.year)} />
              <Field label="Location" value={box.address} />
            </div>

            {/* Photo strip */}
            {hasRealPhotos && photos!.length > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 9, letterSpacing: "0.06em", fontWeight: 500, textTransform: "uppercase", color: "#AAAAAA", lineHeight: "12px", fontFamily: '"Geist", system-ui, sans-serif' }}>
                  Photos ({photos!.length})
                </span>
                <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 2 }}>
                  {photos!.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIdx(i)}
                      style={{
                        flexShrink: 0,
                        width: 72,
                        height: 72,
                        position: "relative",
                        overflow: "hidden",
                        background: "#1A1A1A",
                        border: i === activeIdx ? "2px solid #202020" : "2px solid transparent",
                        borderRadius: 3,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <Image src={src} alt="" fill style={{ objectFit: "contain" }} unoptimized />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collect button */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={onCollect}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flex: 1,
                  paddingBlock: 10,
                  paddingInline: 16,
                  border: "1px solid #202020",
                  background: isCollected ? "#202020" : "transparent",
                  cursor: "pointer",
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}
              >
                {isCollected ? (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2 6.5L5.5 10L11 3" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 2V11M2 6.5H11" stroke="#202020" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: "-0.04em",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    color: isCollected ? "#FFFFFF" : "#202020",
                    lineHeight: "14px",
                  }}
                >
                  {isCollected ? "Collected" : "Collect"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main image */}
      <div style={{ flex: 1, alignSelf: "stretch", position: "relative", overflow: "hidden", background: hasRealPhotos ? "#111" : undefined }}>
        <Image
          src={activePhotoSrc}
          alt={box.title}
          fill
          style={{ objectFit: hasRealPhotos ? "contain" : "cover" }}
          priority
          unoptimized={hasRealPhotos}
        />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 9,
          letterSpacing: "0.06em",
          fontWeight: 500,
          textTransform: "uppercase",
          color: "#AAAAAA",
          lineHeight: "12px",
          fontFamily: '"Geist", system-ui, sans-serif',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          letterSpacing: "-0.03em",
          fontWeight: 500,
          color: "#202020",
          lineHeight: "16px",
          fontFamily: '"Geist", system-ui, sans-serif',
        }}
      >
        {value}
      </span>
    </div>
  );
}

