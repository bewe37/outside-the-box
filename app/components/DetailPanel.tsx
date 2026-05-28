"use client";

import React, { useState } from "react";
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
}: {
  box: Box;
  displayNumber: number;
  isCollected: boolean;
  onCollect: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const photos = box.images ?? [];
  const heroSrc = photos[0] ?? "";
  const [aspect, setAspect] = useState<number | null>(null);

  React.useEffect(() => {
    setAspect(null);
    if (!heroSrc) return;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = heroSrc;
  }, [heroSrc]);

  const HERO_H = 320;
  const HERO_W = aspect ? Math.round(HERO_H * aspect) : HERO_H;
  const PANEL_W = Math.min(Math.max(HERO_W + 32, 520), window.innerWidth - 48);
  const PANEL_H = 820;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }} onClick={(e) => e.stopPropagation()}>
      <div
        style={{
          width: PANEL_W,
          height: PANEL_H,
          maxHeight: "calc(100vh - 120px)",
          boxSizing: "border-box",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 0,
          paddingRight: 0,
          backgroundColor: "#FFFFFF",
          border: "1px solid #C9C9C9",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          fontFamily: '"Geist", system-ui, sans-serif',
          color: "#202020",
          fontWeight: 400,
          overflow: "hidden",
        }}
      >
        {/* Caption + title */}
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, paddingInline: 16 }}>
          <span style={{ fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label, textTransform: "uppercase", marginBottom: 4 }}>
            ({String(displayNumber).padStart(3, "0")}) CAPTURED {box.captured}
          </span>
          <span style={{ fontSize: size.subtitle, lineHeight: leading.subtitle, letterSpacing: tracking.normal, textTransform: "uppercase" }}>
            {box.title}
          </span>
        </div>

        {/* Hero */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ position: "relative", width: "100%", height: HERO_H }}>
            <Image
              src={heroSrc}
              alt={box.title}
              fill
              style={{ objectFit: "contain" }}
              priority
              unoptimized
              placeholder="blur"
              blurDataURL={BLUR_PLACEHOLDER}
            />
          </div>
        </div>

        {/* Metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto", minHeight: 0, paddingInline: 16 }}>
          <MetaRow label="Artist" value={box.artist} />
          <MetaRow label="Year" value={formatYear(box.year)} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ width: 120, flexShrink: 0, fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label, textTransform: "uppercase" }}>Location</span>
            <MapAddress address={box.address} />
          </div>
          <MetaRow label="Neighbourhood" value={formatNeighbourhood(box.neighbourhood)} />
          {box.description && <MetaRow label="Artwork Description" value={box.description} multiline />}

          {photos.length > 1 && (
            <div style={{ display: "flex", alignItems: "start", gap: 16 }}>
              <span style={{ width: 120, flexShrink: 0, fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label, textTransform: "uppercase" }}>
                More Photos
              </span>
              <div className="thumb-strip" style={{ flex: 1, display: "flex", gap: 4, overflowX: "auto", scrollSnapType: "x mandatory" }}>
                {photos.slice(1).map((src, i) => (
                  <div key={i} style={{ flex: "0 0 88px", width: 88, height: 88, position: "relative", scrollSnapAlign: "start" }}>
                    <Image src={src} alt="" fill style={{ objectFit: "cover" }} unoptimized loading="lazy" placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prev / collect / next */}
      <div style={{ display: "flex", gap: 8 }}>
        <PillButton onClick={() => onPrev?.()} disabled={!hasPrev} ariaLabel="Previous box">
          <ChevronIcon dir="left" />
        </PillButton>
        <PillButton onClick={onCollect} filled={isCollected} ariaLabel={isCollected ? "Collected" : "Add to collection"}>
          {isCollected ? <CheckIcon /> : <PlusIcon />}
        </PillButton>
        <PillButton onClick={() => onNext?.()} disabled={!hasNext} ariaLabel="Next box">
          <ChevronIcon dir="right" />
        </PillButton>
      </div>
    </div>
  );
}

function MapAddress({ address }: { address: string }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ", Toronto, Ontario")}`;
  return (
    <div style={{ flex: 1 }}>
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

function MetaRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "start", gap: 16 }}>
      <span style={{ width: 120, flexShrink: 0, fontSize: size.meta, lineHeight: leading.meta, letterSpacing: tracking.label, textTransform: "uppercase" }}>{label}</span>
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
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 38, height: 38, padding: 0, borderRadius: "50%",
        backgroundColor: filled ? "#202020" : "#FFFFFF",
        border: "1px solid #C9C9C9",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: '"Geist", system-ui, sans-serif',
      }}
    >
      {children}
    </button>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d={dir === "left" ? "M7.5 2L3.5 6L7.5 10" : "M4.5 2L8.5 6L4.5 10"} stroke="#202020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
