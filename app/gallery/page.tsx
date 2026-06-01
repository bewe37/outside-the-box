"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { boxes, formatNeighbourhood, formatYear, formatAddress, type Box, type Neighbourhood } from "@/lib/data";
import { DetailPanel } from "@/app/components/DetailPanel";
import { size, tracking, leading } from "@/lib/typography";
import { useNav } from "@/app/components/nav-context";
import { useAuth } from "@/app/components/auth-context";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Toast } from "@/app/components/Toast";
import gsap from "gsap";

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
  const [photoColumns, setPhotoColumns] = useState(3);
  const prevColumns = useRef(3);

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

// Preview is pinned to the hovered row's vertical position at a fixed X past
// the text columns. Its actual width/height is derived per-image from the
// photo's natural aspect ratio (see previewSize below).
const HOVER_PREVIEW = {
  left: 1120,        // pinned X (past the row's text columns)
  maxEdge: 280,      // bounding box for either dimension
  fallback: { width: 200, height: 280 }, // before aspect is known
};

// Fit (maxEdge × maxEdge) box while preserving an aspect ratio. Landscapes
// become wider+shorter, portraits taller+narrower.
function previewSize(aspect: number): { width: number; height: number } {
  if (aspect >= 1) {
    // Landscape or square — width hits max, height shrinks.
    return { width: HOVER_PREVIEW.maxEdge, height: Math.round(HOVER_PREVIEW.maxEdge / aspect) };
  }
  // Portrait — height hits max, width shrinks.
  return { width: Math.round(HOVER_PREVIEW.maxEdge * aspect), height: HOVER_PREVIEW.maxEdge };
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
  const [rowTop, setRowTop] = useState(0);
  // box.id → aspect ratio (width / height). Loaded lazily on first hover.
  const [aspects, setAspects] = useState<Map<number, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // On row enter, measure the row's offset within the scroll container so the
  // preview can pin to its vertical position. Only updates per row — not on
  // every cursor move within the row.
  function handleRowEnter(box: Box, e: React.MouseEvent) {
    const container = containerRef.current;
    if (!container) return;
    const rowRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setRowTop(rowRect.top - containerRect.top + container.scrollTop);
    setHovered(box);

    // Lazy-load the cover photo's natural dimensions on first hover. Cached
    // afterwards so re-hovering the same row is instant.
    if (!aspects.has(box.id)) {
      const src = imgUrl(box);
      if (!src) return;
      const img = new window.Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setAspects((prev) => new Map(prev).set(box.id, img.naturalWidth / img.naturalHeight));
        }
      };
      img.src = src;
    }
  }

  const hoveredAspect = hovered ? aspects.get(hovered.id) : undefined;
  const hoveredSize = hoveredAspect ? previewSize(hoveredAspect) : HOVER_PREVIEW.fallback;
  // Clamp so the preview never extends below the container's scroll height.
  const container = containerRef.current;
  const maxTop = container ? container.scrollTop + container.clientHeight - hoveredSize.height - 24 : rowTop;
  const clampedTop = Math.min(rowTop, maxTop);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: "relative",
        overflowY: "auto",
        paddingTop: 64,
        paddingInline: 32,
      }}
    >
      {boxes.map((box, i) => (
        <motion.div
          key={box.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, delay: i * 0.035, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ width: "fit-content" }}
        >
          <IndexRow
            box={box}
            displayNumber={i + 1}
            isSelected={false}
            isDimmed={hovered !== null && hovered.id !== box.id}
            isCollected={collected.has(box.id)}
            onSelect={() => onSelect(box)}
            onMouseEnter={(e) => handleRowEnter(box, e)}
            onMouseLeave={() => setHovered(null)}
          />
        </motion.div>
      ))}

      {/* Row-pinned hover preview. Positioned at a fixed X past the text columns. */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key={hovered.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: HOVER_PREVIEW.left,
              top: clampedTop,
              width: hoveredSize.width,
              height: hoveredSize.height,
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: 10,
              willChange: "opacity",
              boxShadow: "0 10px 32px rgba(0, 0, 0, 0.12)",
              backgroundColor: "#FFFFFF",
            }}
          >
            <Image
              src={imgUrl(hovered)}
              alt={hovered.title}
              fill
              style={{ objectFit: "cover" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IndexRow({
  box,
  displayNumber,
  isSelected,
  isDimmed,
  isCollected,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: {
  box: Box;
  displayNumber: number;
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
      className="index-row index-row-btn"
      style={{
        display: "flex",
        alignItems: "center",
        paddingBlock: 12,
        paddingInline: 0,
        background: "none",
        border: "none",
        borderBottom: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "fit-content",
        fontFamily: "inherit",
        fontWeight: 400,
      }}
    >
      {/* Inner row — becomes full-width flex on mobile */}
      <div className="index-row-inner" style={{ display: "flex", alignItems: "center" }}>

        {/* Number + Title — 400px */}
        <div style={{ width: 400, flexShrink: 0, display: "flex", flexDirection: "column", paddingLeft: 0, paddingRight: 48, boxSizing: "border-box", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                flexShrink: 0,
                fontSize: size.meta,
                lineHeight: leading.meta,
                letterSpacing: tracking.label,
                textTransform: "uppercase",
                color: textColor,
                transition,
              }}
            >
              ({String(displayNumber).padStart(2, "0")})
            </span>
            <span
              style={{
                fontSize: size.meta,
                lineHeight: leading.meta,
                letterSpacing: tracking.label,
                textTransform: "uppercase",
                color: textColor,
                transition,
              }}
            >
              {box.title}
            </span>
          </div>
          {/* Date — only visible on mobile */}
          <span
            className="index-date"
            style={{
              display: "none",
              fontSize: size.caption,
              lineHeight: leading.caption,
              letterSpacing: tracking.label,
              color: textColor,
              transition,
            }}
          >
            {box.captured}
          </span>
        </div>

        {/* Artist — 240px */}
        <span
          className="index-col"
          style={{
            width: 240,
            flexShrink: 0,
            paddingRight: 48,
            boxSizing: "border-box",
            fontSize: size.meta,
            lineHeight: leading.meta,
            letterSpacing: tracking.label,
            textTransform: "uppercase",
            color: textColor,
            transition,
          }}
        >
          {box.artist}
        </span>

        {/* Address — 280px */}
        <span
          className="index-col"
          style={{
            width: 280,
            flexShrink: 0,
            paddingRight: 48,
            boxSizing: "border-box",
            fontSize: size.meta,
            lineHeight: leading.meta,
            letterSpacing: tracking.label,
            textTransform: "uppercase",
            color: textColor,
            transition,
          }}
        >
          {formatAddress(box.address)}
        </span>

        {/* Neighbourhood — 220px */}
        <span
          className="index-col"
          style={{
            width: 220,
            flexShrink: 0,
            fontSize: size.meta,
            lineHeight: leading.meta,
            letterSpacing: tracking.label,
            textTransform: "uppercase",
            color: textColor,
            transition,
          }}
        >
          {formatNeighbourhood(box.neighbourhood)}
        </span>

        {/* Collected dot */}
        <span
          style={{
            marginLeft: 16,
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

        {/* Thumbnail — only visible on mobile */}
        {box.images?.[0] && (
          <div
            className="index-thumb"
            style={{
              display: "none",
              width: 72,
              height: 72,
              flexShrink: 0,
              overflow: "hidden",
              marginLeft: 16,
            }}
          >
            <Image
              src={box.images[0]}
              alt={box.title}
              width={80}
              height={80}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Stamp ────────────────────────────────────────────────────────────────────

// Built-in neighbourhoods have stamp graphics; custom ones fall back to text.
const NEIGHBOURHOOD_STAMPS: Record<string, string> = {
  "LESLIEVILLE":       "/Yonge.svg",
  "PARKDALE":          "/Dufferin.svg",
  "KENSINGTON":        "/Kensington.svg",
  "TRINITY BELLWOODS": "/TrinityBellwoods.svg",
  "RIVERSIDE":         "/Harbourfront.svg",
  "CORK TOWN":         "/CabbageTown.svg",
  "THE ANNEX":         "/Annex.svg",
};

const NEIGHBOURHOOD_ROTATION: Record<string, number> = {
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
        textTransform: "uppercase", color, transition: "color 0.12s ease",
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
                  onChange={(e) => { prevColumnsRef.current = photoColumns; onColumnsChange(Number(e.target.value)); }}
                />
                <span style={{ display: "inline-block", width: 10, height: 16, overflow: "hidden", position: "relative", verticalAlign: "middle" }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={photoColumns}
                      initial={{ y: photoColumns > prevColumnsRef.current ? "100%" : "-100%" }}
                      animate={{ y: "0%" }}
                      exit={{ y: photoColumns > prevColumnsRef.current ? "-100%" : "100%" }}
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
