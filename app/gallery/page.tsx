"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { boxes, NEIGHBOURHOODS, type Box, type Neighbourhood } from "@/lib/data";

const GridView = dynamic(() => import("./GridView3D"), { ssr: false });

type ViewMode = "INDEX" | "GRID";

function imgUrl(id: number, w: number, h: number) {
  return `https://picsum.photos/seed/box${id}/${w}/${h}`;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({
  view,
  onViewChange,
  collectedCount,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  collectedCount: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBlock: 18,
        paddingInline: 16,
        position: "relative",
        flexShrink: 0,
        borderBottom: view === "GRID" ? "1px solid #D3D3D3" : "none",
      }}
    >
      {/* Left — wordmark */}
      <span
        style={{
          fontSize: 14,
          letterSpacing: "-0.06em",
          fontWeight: 500,
          textTransform: "uppercase",
          whiteSpace: "pre",
          color: "#202020",
          lineHeight: "18px",
        }}
      >
        OutsideTheBox
      </span>

      {/* Center — nav links */}
      <div
        style={{
          display: "flex",
          gap: 20,
          position: "absolute",
          left: "50%",
          top: 18,
          translate: "-50%",
        }}
      >
        <NavLink href="/gallery" active>GALLERY</NavLink>
        <NavLink href="/about">ABOUT</NavLink>
        <NavLink href="/collection">MY COLLECTION ({collectedCount})</NavLink>
      </div>

      {/* Right — view toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={() => onViewChange("GRID")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
        >
          {view === "GRID" && (
            <span style={{ width: 4, height: 8, borderRadius: 1, backgroundColor: "#202020", flexShrink: 0, display: "inline-block" }} />
          )}
          <span style={{ fontSize: 14, letterSpacing: "-0.06em", fontWeight: 500, textTransform: "uppercase", color: view === "GRID" ? "#202020" : "#A8A8A8", lineHeight: "18px" }}>
            GRID
          </span>
        </button>

        <button
          onClick={() => onViewChange("INDEX")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
        >
          {view === "INDEX" && (
            <span style={{ width: 4, height: 8, borderRadius: 1, backgroundColor: "#202020", flexShrink: 0, display: "inline-block" }} />
          )}
          <span style={{ fontSize: 14, letterSpacing: "-0.06em", fontWeight: 500, textTransform: "uppercase", color: view === "INDEX" ? "#202020" : "#A8A8A8", lineHeight: "18px" }}>
            INDEX
          </span>
        </button>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 14,
        letterSpacing: "-0.06em",
        fontWeight: 500,
        textTransform: "uppercase",
        color: active ? "#202020" : "#A8A8A8",
        textDecoration: "none",
        lineHeight: "18px",
      }}
    >
      {children}
    </Link>
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
            fontSize: 13,
            letterSpacing: "-0.06em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: "#202020",
            lineHeight: "16px",
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
                fontSize: 13,
                letterSpacing: "-0.06em",
                fontWeight: 500,
                textTransform: "uppercase",
                lineHeight: "16px",
                paddingBlock: 6,
                paddingInline: 12,
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
  const [view, setView] = useState<ViewMode>("INDEX");
  const [filter, setFilter] = useState<Neighbourhood | "ALL">("ALL");
  const [selected, setSelected] = useState<Box | null>(null);
  const [hovered, setHovered] = useState<Box | null>(null);
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [gridSelected, setGridSelected] = useState<Box | null>(null);

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

  const filtered = filter === "ALL" ? boxes : boxes.filter((b) => b.neighbourhood === filter);

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
      <Nav view={view} onViewChange={setView} collectedCount={collected.size} />
      <AnimatePresence>
        {view === "INDEX" && (
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
          ) : (
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
                src={imgUrl(hovered.id, 264, 400)}
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
            fontSize: 14,
            letterSpacing: "-0.06em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: textColor,
            lineHeight: "18px",
            transition,
          }}
        >
          ({String(box.id).padStart(3, "0")})
        </span>
        <span
          style={{
            fontSize: 14,
            letterSpacing: "-0.06em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: textColor,
            lineHeight: "18px",
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
          fontSize: 13,
          letterSpacing: "-0.06em",
          fontWeight: 500,
          textTransform: "uppercase",
          color: textColor,
          lineHeight: "16px",
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
            fontSize: 12,
            letterSpacing: "-0.04em",
            fontWeight: 500,
            marginBottom: 12,
            color: "#202020",
            lineHeight: "16px",
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
          {/* Title */}
          <span
            style={{
              fontSize: 32,
              lineHeight: "44px",
              letterSpacing: "-0.05em",
              fontWeight: 600,
              textTransform: "uppercase",
              marginBottom: 40,
              color: "#202020",
              fontFamily: '"Geist", system-ui, sans-serif',
              display: "block",
            }}
          >
            {box.title}
          </span>

          {/* Bottom section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Artist" value={box.artist} />
              <Field label="Year" value={String(box.year)} />
              <Field label="Location" value={box.address} />
            </div>

            {/* More photos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "-0.04em",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  color: "#202020",
                  lineHeight: "14px",
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}
              >
                More Photos
              </span>
              <div style={{ display: "flex", gap: 2, height: 129 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    <Image
                      src={imgUrl(box.id * 10 + i, 200, 258)}
                      alt=""
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            </div>

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
                    fontSize: 13,
                    letterSpacing: "-0.06em",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    color: isCollected ? "#FFFFFF" : "#202020",
                    lineHeight: "16px",
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
      <div style={{ flex: 1, alignSelf: "stretch", position: "relative", overflow: "hidden" }}>
        <Image
          src={imgUrl(box.id, 800, 1000)}
          alt={box.title}
          fill
          style={{ objectFit: "cover" }}
          priority
        />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "-0.04em",
          fontWeight: 500,
          textTransform: "uppercase",
          color: "#202020",
          lineHeight: "14px",
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          letterSpacing: "-0.05em",
          fontWeight: 500,
          color: "#202020",
          lineHeight: "18px",
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        {value}
      </span>
    </div>
  );
}

