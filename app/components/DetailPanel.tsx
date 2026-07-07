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
  prevSrc,
  nextSrc,
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
  prevSrc?: string;         // cover of the previous box (left peek)
  nextSrc?: string;         // cover of the next box (right peek)
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
  // Which of this box's photos is showing on the left stage carousel.
  const [photoIndex, setPhotoIndex] = useState(0);
  // Aspect ratio (w/h) per photo src, so each carousel card keeps its own shape.
  const [photoAspects, setPhotoAspects] = useState<Record<string, number>>({});

  useEffect(() => { setMounted(true); }, []);
  // Reset the photo carousel whenever the box changes.
  useEffect(() => { setPhotoIndex(0); }, [box.id]);

  // Load each photo's natural aspect ratio so cards are sized individually.
  useEffect(() => {
    allPhotos.forEach((src) => {
      if (!src || photoAspects[src]) return;
      const img = new window.Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setPhotoAspects((prev) => prev[src] ? prev : { ...prev, [src]: img.naturalWidth / img.naturalHeight });
        }
      };
      img.src = src;
    });
  }, [allPhotos, photoAspects]);

  const currentPhoto = allPhotos[photoIndex] ?? heroSrc;

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

  // Panel navigation (lightbox closed): arrows step through this box's photos,
  // then roll over to the previous/next box.
  useEffect(() => {
    if (lightboxIndex !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (photoIndex < allPhotos.length - 1) setPhotoIndex((i) => i + 1);
        else if (hasNext) onNext?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (photoIndex > 0) setPhotoIndex((i) => i - 1);
        else if (hasPrev) onPrev?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photoIndex, allPhotos.length, hasNext, hasPrev, onNext, onPrev, onClose]);

  React.useEffect(() => {
    setAspect(null);
    setHeroLoaded(false);
    if (!currentPhoto) return;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = currentPhoto;
  }, [currentPhoto]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onSwapPhoto) return;
    setUploading(true);
    await onSwapPhoto(file);
    setUploading(false);
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const isMobile = vw <= 640;
  const SIDEBAR_W = 340;

  // Shared photo lightbox (used by both mobile and desktop layouts).
  const lightbox = mounted ? createPortal(
    <AnimatePresence>
      {lightboxIndex !== null && (
        <motion.div
          key="photo-lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={closeLightbox}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
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
            <img src={lightboxIndex !== null ? allPhotos[lightboxIndex] : ""} alt="" style={{ display: "block", maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }} />
          </motion.div>
          <button onClick={closeLightbox} className="close-btn" style={{ position: "fixed", top: 20, right: 20, background: "none", border: "none", cursor: "pointer", padding: 8, lineHeight: 1 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
          {lightboxIndex !== null && lightboxIndex > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }} className="lightbox-arrow" style={{ position: "fixed", left: 20, top: "50%", translate: "0 -50%", background: "none", border: "none", cursor: "pointer", padding: 12 }}>
              <ChevronIcon dir="left" color="#202020" />
            </button>
          )}
          {lightboxIndex !== null && lightboxIndex < allPhotos.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }} className="lightbox-arrow" style={{ position: "fixed", right: 20, top: "50%", translate: "0 -50%", background: "none", border: "none", cursor: "pointer", padding: 12 }}>
              <ChevronIcon dir="right" color="#202020" />
            </button>
          )}
          {allPhotos.length > 1 && lightboxIndex !== null && (
            <div style={{ position: "fixed", bottom: 24, left: "50%", translate: "-50% 0", fontSize: size.caption, letterSpacing: tracking.loose, color: "#202020", fontFamily: '"Geist", system-ui, sans-serif' }}>
              {lightboxIndex + 1} / {allPhotos.length}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  ) : null;

  // ── Mobile: the old single-column panel (image on top, scrollable meta) ────
  if (isMobile) {
    const isLandscape = aspect !== null && aspect > 1;
    const HERO_H = Math.round(vw * 0.75);
    const labelW = 100;
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100dvh" }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            width: "100%", height: "100dvh", boxSizing: "border-box",
            paddingTop: 16, paddingBottom: 16,
            backgroundColor: "#FFFFFF", border: "none",
            display: "flex", flexDirection: "column", gap: 12,
            fontFamily: '"Geist", system-ui, sans-serif', color: "#202020", fontWeight: 400,
            overflow: "hidden",
          }}
        >
          {/* Caption + title + collect */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0, paddingInline: 16 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: size.caption, lineHeight: leading.caption, letterSpacing: tracking.loose, textTransform: "uppercase", marginBottom: 4 }}>
                ({String(displayNumber).padStart(3, "0")}) {capturedLabel} {box.captured}
              </span>
              <span style={{ fontSize: size.subtitle, lineHeight: leading.subtitle, letterSpacing: tracking.normal, textTransform: "uppercase" }}>
                {box.title}
              </span>
            </div>
            <CollectButton isCollected={isCollected} onClick={onCollect} />
          </div>

          {/* Scrollable body — hero + metadata */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Hero */}
            <div style={{ flexShrink: 0, position: "relative", paddingInline: 16, height: HERO_H }}>
              {!heroLoaded && <div className="img-shimmer" style={{ position: "absolute", left: 16, right: 16, top: 0, height: HERO_H, zIndex: 1 }} />}
              <div style={{ position: "absolute", top: 0, left: 16, right: 16, height: HERO_H, cursor: "zoom-in" }} onClick={() => setLightboxIndex(photoIndex)}>
                <Image
                  key={currentPhoto}
                  src={currentPhoto}
                  alt={box.title}
                  fill
                  style={{ objectFit: isLandscape ? "cover" : "contain", opacity: heroLoaded ? 1 : 0, transition: "opacity 0.3s ease", filter: "saturate(1.15)" }}
                  onLoad={() => setTimeout(() => setHeroLoaded(true), 80)}
                />
              </div>
            </div>

            {/* Metadata */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingInline: 16, paddingBottom: 16 }}>
              <MetaRow label="Artist" value={box.artist} labelW={labelW} />
              <MetaRow label="Year" value={formatYear(box.year)} labelW={labelW} />
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ width: labelW, flexShrink: 0, fontSize: size.caption, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase" }}>Location</span>
                <MapAddress address={box.address} align="start" />
              </div>
              <MetaRow label="Neighbourhood" value={formatNeighbourhood(box.neighbourhood)} labelW={labelW} />
              {box.description && <MetaRow label="Artwork Description" value={box.description} multiline labelW={labelW} />}

              {onSwapPhoto && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" style={{ display: "none" }} onChange={handleFileChange} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", fontFamily: "inherit", color: uploading ? "#CACACA" : "#202020", background: "none", border: "none", cursor: uploading ? "default" : "pointer", padding: 0 }}>
                    {uploading ? "Uploading…" : userPhoto ? "Swap photo" : "Use my photo"}
                  </button>
                </div>
              )}

              {/* Photo thumbnails */}
              {allPhotos.length > 1 && (
                <div style={{ display: "flex", alignItems: "start", gap: 16, borderTop: "1px solid #F4F4F4", paddingTop: 14 }}>
                  <span style={{ width: labelW, flexShrink: 0, fontSize: size.caption, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase" }}>Photos</span>
                  <div className="thumb-strip" style={{ flex: 1, display: "flex", gap: 4, overflowX: "auto", scrollSnapType: "x mandatory" }}>
                    {allPhotos.map((src, i) => (
                      <div key={i} onClick={() => setPhotoIndex(i)} style={{ flex: "0 0 72px", width: 72, height: 72, position: "relative", scrollSnapAlign: "start", cursor: "pointer", outline: i === photoIndex ? "2px solid #202020" : "none", outlineOffset: -2 }}>
                        <Image src={src} alt="" fill style={{ objectFit: "cover", filter: "saturate(1.15)" }} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Prev / close / next */}
          <div style={{ display: "flex", gap: 8, paddingInline: 16, paddingBottom: 8, flexShrink: 0, justifyContent: "center" }}>
            <PillButton onClick={() => onPrev?.()} disabled={!hasPrev} ariaLabel="Previous box"><ChevronIcon dir="left" /></PillButton>
            <PillButton onClick={() => onClose?.()} ariaLabel="Close">
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </PillButton>
            <PillButton onClick={() => onNext?.()} disabled={!hasNext} ariaLabel="Next box"><ChevronIcon dir="right" /></PillButton>
          </div>
        </div>

        {/* Photo lightbox (shared) */}
        {mounted && lightbox}
      </div>
    );
  }

  // Full-screen two-pane layout: image carousel (left) + metadata sidebar (right).
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        backgroundColor: "#FFFFFF",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        fontFamily: '"Geist", system-ui, sans-serif',
        color: "#202020",
        fontWeight: 400,
      }}
    >
      {/* ── Left: coverflow image carousel ────────────────────────────────── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          minWidth: 0,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "56px 16px 16px" : 48,
        }}
      >
        {/* Center card size, derived from aspect. Neighbours are scaled down and
            pushed aside; the active card grows and centres. */}
        {(() => {
          // Every card fits within a fixed stage height and keeps its OWN
          // aspect ratio, so switching orientations never resizes the layout.
          const stageH = isMobile ? Math.round(vw * 0.72) : 520;
          const GAP = isMobile ? 16 : 28;   // px gap between adjacent cards
          const scaleFor = (abs: number) => (abs === 0 ? 1 : abs === 1 ? 0.72 : 0.5);
          // Cap the width too, so wide/landscape photos don't overflow on mobile.
          const maxW = isMobile ? Math.round(vw * 0.78) : Infinity;
          const cardWidth = (src: string) => Math.min(maxW, Math.round(stageH * (photoAspects[src] ?? aspect ?? 0.75)));

          // Precompute cumulative x offsets outward from the active card so the
          // gap between neighbours is even regardless of orientation.
          const xFor = (targetOffset: number): number => {
            if (targetOffset === 0) return 0;
            const dir = Math.sign(targetOffset);
            let x = cardWidth(allPhotos[photoIndex] ?? "") / 2; // active half-width
            for (let step = 1; step <= Math.abs(targetOffset); step++) {
              const idx = photoIndex + dir * step;
              const w = cardWidth(allPhotos[idx] ?? "") * scaleFor(step);
              x += GAP + w / 2;
              if (step < Math.abs(targetOffset)) x += w / 2;
            }
            return dir * x;
          };

          return allPhotos.map((src, i) => {
            const offset = i - photoIndex;
            const abs = Math.abs(offset);
            if (abs > 2) return null;  // active + up to two cards deep each side
            const isActive = offset === 0;
            const cardW = cardWidth(src);
            return (
              <motion.div
                key={src}
                onClick={() => (isActive ? setLightboxIndex(i) : setPhotoIndex(i))}
                initial={false}
                animate={{
                  x: xFor(offset),
                  scale: scaleFor(abs),
                  opacity: abs === 0 ? 1 : abs === 1 ? 0.55 : 0.32,
                  zIndex: 5 - abs,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
                style={{
                  position: "absolute",
                  width: cardW,
                  height: stageH,
                  cursor: isActive ? "zoom-in" : "pointer",
                  boxShadow: isActive ? "0 24px 70px rgba(0,0,0,0.18)" : "0 12px 40px rgba(0,0,0,0.10)",
                  backgroundColor: "#F0F0F0",
                  overflow: "hidden",
                }}
              >
                <Image
                  src={src}
                  alt={box.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  style={{ objectFit: "cover", filter: "saturate(1.15)" }}
                  onLoad={isActive ? () => setTimeout(() => setHeroLoaded(true), 80) : undefined}
                />
              </motion.div>
            );
          });
        })()}

        {/* Photo counter — tabular figures + centred digit slots so the width
            never shifts between "1 / 3" and "3 / 3" (or double digits). */}
        {allPhotos.length > 1 && (
          <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", fontSize: size.caption, letterSpacing: tracking.loose, color: "#202020", background: "rgba(255,255,255,0.9)", padding: "3px 10px", pointerEvents: "none", zIndex: 3, display: "flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" } as React.CSSProperties}>
            <span style={{ minWidth: "1.1ch", textAlign: "right" }}>{photoIndex + 1}</span>
            <span>/</span>
            <span style={{ minWidth: "1.1ch", textAlign: "left" }}>{allPhotos.length}</span>
          </div>
        )}
      </div>

      {/* ── Right: metadata sidebar ───────────────────────────────────────── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : SIDEBAR_W,
          flexShrink: 0,
          borderLeft: isMobile ? "none" : "1px solid #E8E8E8",
          borderTop: isMobile ? "1px solid #E8E8E8" : "none",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Top controls: prev/next (left) + close (right) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <PillButton onClick={() => onPrev?.()} disabled={!hasPrev} ariaLabel="Previous box">
              <ChevronIcon dir="left" />
            </PillButton>
            <PillButton onClick={() => onNext?.()} disabled={!hasNext} ariaLabel="Next box">
              <ChevronIcon dir="right" />
            </PillButton>
          </div>
          <PillButton onClick={() => onClose?.()} ariaLabel="Close">
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </PillButton>
        </div>

        {/* Sidebar body — content on top, collect pinned to the bottom */}
        <div style={{ flex: 1, minHeight: 0, padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Caption + title */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: size.caption, lineHeight: leading.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#202020", marginBottom: 6 }}>
              ({String(displayNumber).padStart(3, "0")}) {capturedLabel} {box.captured}
            </span>
            <span style={{ fontSize: size.subtitle, lineHeight: leading.subtitle, letterSpacing: tracking.normal, textTransform: "uppercase" }}>
              {box.title}
            </span>
          </div>

          {/* Description */}
          {box.description && (
            <p style={{ margin: 0, fontSize: size.meta, lineHeight: leading.body, letterSpacing: tracking.normal, color: "#202020", textWrap: "pretty" } as React.CSSProperties}>
              {box.description}
            </p>
          )}

          {/* Metadata rows — right-aligned values */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <SidebarRow label="Artist" value={box.artist} />
            <SidebarRow label="Year" value={formatYear(box.year)} />
            <SidebarRow label="Neighbourhood" value={formatNeighbourhood(box.neighbourhood)} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingBlock: 12, borderTop: "1px solid #F4F4F4" }}>
              <span style={{ fontSize: size.caption, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#202020" }}>Location</span>
              <MapAddress address={box.address} lat={box.lat} lng={box.lng} />
            </div>
          </div>

          {/* Swap photo (own collection only) */}
          {onSwapPhoto && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
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
                  color: uploading ? "#CACACA" : "#202020",
                  background: "none", border: "none",
                  cursor: uploading ? "default" : "pointer", padding: 0,
                }}
              >
                {uploading ? "Uploading…" : userPhoto ? "Swap photo" : "Use my photo"}
              </button>
            </div>
          )}

          {/* Collect — pinned to the bottom of the sidebar */}
          <div style={{ marginTop: "auto", paddingTop: 20, display: "flex" }}>
            <CollectButton isCollected={isCollected} onClick={onCollect} full />
          </div>
        </div>
      </div>

      {/* Photo lightbox (shared) */}
      {mounted && lightbox}

    </div>
  );
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingBlock: 12, borderTop: "1px solid #F4F4F4" }}>
      <span style={{ flexShrink: 0, fontSize: size.caption, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#202020" }}>{label}</span>
      <span style={{ fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.normal, color: "#202020", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function MapAddress({ address, align = "end" }: { address: string; align?: "start" | "end"; lat?: number; lng?: number }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ", Toronto, Ontario")}`;
  return (
    <div style={{ flex: 1, display: "flex", justifyContent: align === "start" ? "flex-start" : "flex-end" }}>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.normal, color: "#202020", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
      >
        {formatAddress(address)}
        <span style={{ fontSize: 10, display: "inline-block", transform: "rotate(45deg) scaleX(-1)", lineHeight: 1 }}>↑</span>
      </a>
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

function CollectButton({ isCollected, onClick, full = false }: { isCollected: boolean; onClick: () => void; full?: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={isCollected ? "Collected" : "Add to collection"}
      whileTap={{ scale: 0.97 }}
      animate={{
        background: isCollected ? "#202020" : hovered ? "#F4F4F4" : "#FFFFFF",
        color: isCollected ? "#FFFFFF" : "#202020",
      }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: "flex", alignItems: "center", justifyContent: full ? "center" : "flex-start", gap: 8,
        padding: full ? "11px 12px" : "6px 12px",
        width: full ? "100%" : undefined,
        border: "1px solid #202020",
        cursor: "pointer", outline: "none",
        fontFamily: '"Geist", system-ui, sans-serif',
        fontSize: size.caption,
        letterSpacing: tracking.loose,
        textTransform: "uppercase",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isCollected ? "collected" : "collect"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {isCollected ? (
              <path d="M2 6L4.5 8.5L10 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <>
                <path d="M6 2.5V9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                <path d="M2.5 6H9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </>
            )}
          </svg>
          {isCollected ? "Collected" : "Collect"}
        </motion.span>
      </AnimatePresence>
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
