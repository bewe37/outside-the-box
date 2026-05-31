"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { type Box, formatNeighbourhood, formatYear, formatAddress } from "@/lib/data";
import { size, tracking, leading } from "@/lib/typography";

const BLUR_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23E8E8E8"/></svg>';

export function DetailPanel({
  box,
  displayNumber,
  isCollected,
  onCollect,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  userPhoto,
  onSwapPhoto,
  onClose,
  capturedLabel = "CAPTURED",
}: {
  box: Box;
  displayNumber: number;
  isCollected: boolean;
  onCollect: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onClose?: () => void;
  capturedLabel?: string;
  userPhoto?: string;       // user's custom photo URL if set
  onSwapPhoto?: (file: File) => Promise<void>; // present only in own collection
}) {
  const photos = box.images ?? [];
  const heroSrc = userPhoto ?? photos[0] ?? "";
  const [aspect, setAspect] = useState<number | null>(null);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allPhotos = [heroSrc, ...photos.slice(1)].filter(Boolean);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") setLightboxIndex((i) => i !== null ? Math.min(i + 1, allPhotos.length - 1) : null);
      if (e.key === "ArrowLeft")  setLightboxIndex((i) => i !== null ? Math.max(i - 1, 0) : null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [lightboxIndex, allPhotos.length, closeLightbox]);

  React.useEffect(() => {
    setAspect(null);
    setHeroLoaded(false);
    if (!heroSrc) return;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = heroSrc;
  }, [heroSrc]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onSwapPhoto) return;
    setUploading(true);
    await onSwapPhoto(file);
    setUploading(false);
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const isMobile = vw <= 640;
  // Panel width is fixed; hero height is derived from aspect so there's no
  // letterbox whitespace — portrait images get taller, landscape images shorter.
  const PANEL_W_PX = isMobile ? vw : Math.min(560, vw - 48);
  const PANEL_W = isMobile ? "100%" : PANEL_W_PX;
  const isLandscape = aspect !== null && aspect > 1;
  const heroContainerW = PANEL_W_PX - 32;
  // Mobile: fixed height for all images so layout doesn't shift between portrait/landscape
  const HERO_H = isMobile
    ? Math.round(vw * 0.75)
    : Math.min(Math.round(heroContainerW / (aspect ?? 1)), 320);
  const PANEL_H = isMobile ? "100dvh" : 820;
  const labelW = isMobile ? 100 : 120;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 0 : 16, width: isMobile ? "100%" : "auto", height: isMobile ? "100dvh" : "auto" }} onClick={(e) => e.stopPropagation()}>
      <div
        style={{
          width: PANEL_W,
          maxHeight: isMobile ? "100dvh" : "calc(100vh - 120px)",
          boxSizing: "border-box",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 0,
          paddingRight: 0,
          backgroundColor: "#FFFFFF",
          border: isMobile ? "none" : "1px solid #E8E8E8",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 12 : 16,
          fontFamily: '"Geist", system-ui, sans-serif',
          color: "#202020",
          fontWeight: 400,
          overflowY: "auto",
        }}
      >
        {/* Caption + title + close */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0, paddingInline: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: size.caption, lineHeight: leading.caption, letterSpacing: tracking.loose, textTransform: "uppercase", marginBottom: 4 }}>
              ({String(displayNumber).padStart(3, "0")}) {capturedLabel} {box.captured}
            </span>
            <span style={{ fontSize: size.subtitle, lineHeight: leading.subtitle, letterSpacing: tracking.normal, textTransform: "uppercase" }}>
              {box.title}
            </span>
          </div>
          {onClose && (
            <button onClick={onClose} className="close-btn" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, lineHeight: 1, fontFamily: "inherit" }}>
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Hero */}
        <div style={{ flexShrink: 0, paddingInline: 16 }}>
          <div
            style={{ position: "relative", width: "100%", height: HERO_H, cursor: "zoom-in" }}
            onClick={() => setLightboxIndex(0)}
          >
            {!heroLoaded && <div className="img-shimmer" style={{ position: "absolute", inset: 0, zIndex: 1 }} />}
            <Image
              src={heroSrc}
              alt={box.title}
              fill
              style={{ objectFit: isLandscape ? "cover" : "contain", opacity: heroLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
              onLoad={() => setTimeout(() => setHeroLoaded(true), 80)}
            />
          </div>
          {onSwapPhoto && (
            <div style={{ display: "flex", justifyContent: "flex-end", paddingInline: 16, paddingTop: 6 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  fontSize: size.caption, letterSpacing: tracking.loose,
                  textTransform: "uppercase", fontFamily: "inherit",
                  color: uploading ? "#CACACA" : "#AAAAAA",
                  background: "none", border: "none",
                  cursor: uploading ? "default" : "pointer", padding: 0,
                }}
              >
                {uploading ? "Uploading…" : userPhoto ? "Swap photo" : "Use my photo"}
              </button>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingInline: 16 }}>
          <MetaRow label="Artist" value={box.artist} labelW={labelW} />
          <MetaRow label="Year" value={formatYear(box.year)} labelW={labelW} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ width: labelW, flexShrink: 0, fontSize: size.caption, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase" }}>Location</span>
            <MapAddress address={box.address} lat={box.lat} lng={box.lng} />
          </div>
          <MetaRow label="Neighbourhood" value={formatNeighbourhood(box.neighbourhood)} labelW={labelW} />
          {box.description && <MetaRow label="Artwork Description" value={box.description} multiline labelW={labelW} />}

          {photos.length > 1 && (
            <div style={{ display: "flex", alignItems: "start", gap: 16, borderTop: "1px solid #F4F4F4", paddingTop: 14 }}>
              <span style={{ width: labelW, flexShrink: 0, fontSize: size.caption, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase" }}>
                More Photos
              </span>
              <div className="thumb-strip" style={{ flex: 1, display: "flex", gap: 4, overflowX: "auto", scrollSnapType: "x mandatory" }}>
                {photos.slice(1).map((src, i) => (
                  <div
                    key={i}
                    onClick={() => setLightboxIndex(i + 1)}
                    style={{ flex: "0 0 88px", width: 88, height: 88, position: "relative", scrollSnapAlign: "start", cursor: "zoom-in" }}
                  >
                    <Image src={src} alt="" fill style={{ objectFit: "cover" }} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prev / collect / next — inside panel on mobile */}
        {isMobile && (
          <div style={{ display: "flex", gap: 8, paddingInline: 16, paddingBottom: 8, flexShrink: 0, justifyContent: "center" }}>
            <PillButton onClick={() => onPrev?.()} disabled={!hasPrev} ariaLabel="Previous box">
              <ChevronIcon dir="left" />
            </PillButton>
            <CollectButton isCollected={isCollected} onClick={onCollect} />
            <PillButton onClick={() => onNext?.()} disabled={!hasNext} ariaLabel="Next box">
              <ChevronIcon dir="right" />
            </PillButton>
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {mounted && createPortal(
        <AnimatePresence>
          {lightboxIndex !== null && (
            <motion.div
              key="photo-lightbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={closeLightbox}
              style={{
                position: "fixed", inset: 0, zIndex: 200,
                background: "rgba(255,255,255,0.95)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {/* Image */}
              <motion.div
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                onClick={(e) => e.stopPropagation()}
                style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", width: "auto", height: "auto" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={allPhotos[lightboxIndex]}
                  alt=""
                  style={{ display: "block", maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }}
                />
              </motion.div>

              {/* Close */}
              <button
                onClick={closeLightbox}
                className="close-btn"
                style={{ position: "fixed", top: 20, right: 20, background: "none", border: "none", cursor: "pointer", padding: 8, lineHeight: 1 }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Prev */}
              {lightboxIndex > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                  className="lightbox-arrow"
                  style={{ position: "fixed", left: 20, top: "50%", translate: "0 -50%", background: "none", border: "none", cursor: "pointer", padding: 12 }}
                >
                  <ChevronIcon dir="left" color="#202020" />
                </button>
              )}

              {/* Next */}
              {lightboxIndex < allPhotos.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                  className="lightbox-arrow"
                  style={{ position: "fixed", right: 20, top: "50%", translate: "0 -50%", background: "none", border: "none", cursor: "pointer", padding: 12 }}
                >
                  <ChevronIcon dir="right" color="#202020" />
                </button>
              )}

              {/* Counter */}
              {allPhotos.length > 1 && (
                <div style={{ position: "fixed", bottom: 24, left: "50%", translate: "-50% 0", fontSize: size.caption, letterSpacing: tracking.loose, color: "#202020", fontFamily: '"Geist", system-ui, sans-serif' }}>
                  {lightboxIndex + 1} / {allPhotos.length}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Prev / collect / next — desktop only (on mobile they're inside the panel) */}
      {!isMobile && (
        <div style={{ display: "flex", gap: 8 }}>
          <PillButton onClick={() => onPrev?.()} disabled={!hasPrev} ariaLabel="Previous box">
            <ChevronIcon dir="left" />
          </PillButton>
          <CollectButton isCollected={isCollected} onClick={onCollect} />
          <PillButton onClick={() => onNext?.()} disabled={!hasNext} ariaLabel="Next box">
            <ChevronIcon dir="right" />
          </PillButton>
        </div>
      )}
    </div>
  );
}

function MapAddress({ address, lat: initLat, lng: initLng }: { address: string; lat?: number; lng?: number }) {
  const [hovered, setHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initLat && initLng ? { lat: initLat, lng: initLng } : null
  );
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const geocoded = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ", Toronto, Ontario")}`;

  const W = 240, H = 160;
  const mapSrc = coords ? `/api/map?lat=${coords.lat}&lng=${coords.lng}` : null;

  async function handleMouseEnter() {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (!anchorRef.current) return;
    setRect(anchorRef.current.getBoundingClientRect());
    setHovered(true);

    if (!coords && !geocoded.current) {
      geocoded.current = true;
      try {
        const q = encodeURIComponent(address + ", Toronto, Ontario, Canada");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
          headers: { "Accept-Language": "en" },
        });
        const data = await res.json();
        if (data[0]) setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } catch {}
    }
  }

  function handleMouseLeave() {
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  }

  const tooltip = mounted && hovered && rect ? createPortal(
    <div
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top - H - 10,
        width: W,
        height: H,
        border: "1px solid #E8E8E8",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        zIndex: 9999,
        background: "#F0F0F0",
        pointerEvents: "none",
      }}
    >
      {mapSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mapSrc} alt="" width={W} height={H} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>
            Loading…
          </span>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ flex: 1 }}>
      <a
        ref={anchorRef}
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.normal, color: "#202020", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
      >
        {formatAddress(address)}
        <span style={{ fontSize: 10, display: "inline-block", transform: "rotate(45deg) scaleX(-1)", lineHeight: 1 }}>↑</span>
      </a>
      {tooltip}
    </div>
  );
}

function MetaRow({ label, value, multiline = false, labelW = 120 }: { label: string; value: string; multiline?: boolean; labelW?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "start", gap: 16 }}>
      <span style={{ width: labelW, flexShrink: 0, fontSize: size.caption, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase" }}>{label}</span>
      <span style={{ flex: 1, fontSize: size.meta, lineHeight: multiline ? leading.body : leading.meta, letterSpacing: tracking.normal, whiteSpace: "pre-wrap" }}>{value}</span>
    </div>
  );
}

function PillButton({ children, onClick, filled = false, disabled = false, ariaLabel }: {
  children: React.ReactNode; onClick: () => void; filled?: boolean; disabled?: boolean; ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`pill-btn${filled ? " filled" : ""}`}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 38, height: 38, padding: 0, borderRadius: "50%",
        backgroundColor: filled ? "#202020" : "#FFFFFF",
        border: "1px solid #E8E8E8",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: '"Geist", system-ui, sans-serif',
        outline: "none",
      }}
    >
      {children}
    </button>
  );
}

function CollectButton({ isCollected, onClick }: { isCollected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  const bg = isCollected
    ? hovered ? "#3A3A3A" : "#202020"
    : hovered ? "#F0F0F0" : "#FFFFFF";

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={isCollected ? "Collected" : "Add to collection"}
      animate={{ backgroundColor: bg, scale: 1 }}
      whileTap={{ scale: 0.88 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 38, height: 38, padding: 0, borderRadius: "50%",
        border: "1px solid #E8E8E8",
        cursor: "pointer", outline: "none",
        fontFamily: '"Geist", system-ui, sans-serif',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <motion.path
          d="M1 6H11"
          stroke={isCollected ? "#FFFFFF" : "#202020"}
          strokeWidth="1.5"
          strokeLinecap="round"
          animate={{ pathLength: isCollected ? 0 : 1, opacity: isCollected ? 0 : 1 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        />
        <motion.path
          stroke={isCollected ? "#FFFFFF" : "#202020"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ d: isCollected ? "M2 6L5 9L10 3" : "M6 1V11" }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </svg>
    </motion.button>
  );
}

function ChevronIcon({ dir, color = "#202020" }: { dir: "left" | "right"; color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d={dir === "left" ? "M7.5 2L3.5 6L7.5 10" : "M4.5 2L8.5 6L4.5 10"} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1V11M1 6H11" stroke="#202020" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6L5 9L10 3" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
