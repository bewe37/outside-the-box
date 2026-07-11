"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "motion/react";
import { boxes, formatNeighbourhood, formatAddress, formatYear, type Box } from "@/lib/data";
import { size, tracking, leading } from "@/lib/typography";
import { useAuth } from "@/app/components/auth-context";
import { useHideNav } from "@/app/components/nav-context";
import { useSetDarkTheme } from "@/app/components/theme-context";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Toast } from "@/app/components/Toast";

const CylinderGallery = dynamic(() => import("../cylinder-test/CylinderGallery3D"), { ssr: false });

// Shared black background for both gallery views.
const BG_COLOR = "#000000";

// CYLINDER — the WebGL drum — is the landing view; INDEX is the flat photo
// grid.
type ViewMode = "CYLINDER" | "INDEX";

// Tiny shared blur placeholder used by every <Image>. Paints instantly while
// the real (multi-hundred-KB) photo streams in.

// ─── Index page ───────────────────────────────────────────────────────────────

// The Index (list) view is desktop-only — phones always get the drum.
const listAllowed = () => typeof window !== "undefined" && window.innerWidth >= 640;

export default function GalleryPage() {
  // Initial view honours ?view=list (the nav's "Index" tab deep-links here);
  // otherwise the cylinder drum.
  const [view, setView] = useState<ViewMode>(() => {
    if (listAllowed() && new URLSearchParams(window.location.search).get("view") === "list") {
      return "INDEX";
    }
    return "CYLINDER";
  });
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [gridSelected, setGridSelected] = useState<Box | null>(null);
  // Natural aspect (w/h) of the clicked grid image — sizes the detail hero's
  // morph target before the hi-res photo loads.
  const [heroAspect, setHeroAspect] = useState(4 / 3);


  // Both views are dark — the cylinder drum and the black editorial list —
  // so the nav wears its dark glass throughout the gallery.
  useSetDarkTheme(true);

  // Keep the view in sync with ?view= when the nav's Gallery/Index tabs push a
  // new query while we're already mounted (Next doesn't remount on same-route
  // query changes). The nav dispatches "gallery-view" so we don't need a
  // Suspense-wrapped useSearchParams.
  useEffect(() => {
    const onViewEvent = (e: Event) => {
      const v = (e as CustomEvent<string>).detail;
      setView(v === "list" && listAllowed() ? "INDEX" : "CYLINDER");
    };
    window.addEventListener("gallery-view", onViewEvent as EventListener);
    return () => window.removeEventListener("gallery-view", onViewEvent as EventListener);
  }, []);

  // Re-read ?view= once after mount. When navigating here from another page
  // (Information → Index), the useState initializer above runs before Next
  // has committed the new URL, so it misses the query and lands on the
  // cylinder instead of the list. By the post-commit frame the URL is right.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (listAllowed() && new URLSearchParams(window.location.search).get("view") === "list") {
        setView("INDEX");
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const { user, setCollectionCount } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState("");
  // Only show boxes that have at least one admin-uploaded photo.
  const hasUpload = (b: Box) => !!(b.images && b.images.length > 0);
  const [allBoxes, setAllBoxes] = useState<Box[]>(() => boxes.filter(hasUpload));
  const [boxesError, setBoxesError] = useState(false);

  const filtered = allBoxes;

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
    // Arrow navigation is owned by the detail panel (photos, then box rollover).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGridSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gridSelected, filtered]);


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
    // Fixed full-viewport, breaking out of page-shell's top padding (which
    // sits in the body's own background) — both gallery views fill the
    // screen edge to edge; the nav pieces float on top.
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        inset: 0,
        fontFamily: '"Geist", system-ui, sans-serif',
        color: "#FFFFFF",
        background: BG_COLOR,
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      <AnimatePresence>
        {toast && <Toast key={toast} message={toast} onDone={() => setToast("")} />}
      </AnimatePresence>
      {boxesError && (
        <div style={{ paddingInline: 12, paddingBlock: 6, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: '"Geist", system-ui, sans-serif', borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          Some boxes couldn't be loaded
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? null : view === "CYLINDER" ? (
            <motion.div
              key="cylinder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              // Fixed full-viewport, breaking out of page-shell's padded flex
              // layout. Nav pills float on top (z 40).
              style={{ position: "fixed", inset: 0, overflow: "hidden", background: BG_COLOR, zIndex: 30 }}
            >
              <CylinderGallery boxes={filtered} />
            </motion.div>
          ) : (
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
                onSelect={(b, aspect) => { setGridSelected(b); setHeroAspect(aspect); }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail overlay — dark floating panel + hero that morphs from the
          clicked grid card (shared layoutId). */}
      <AnimatePresence>
        {gridSelected && (
          <div key="grid-detail" style={{ position: "fixed", inset: 0, zIndex: 60 }}>
            <GridDetail key={gridSelected.id} box={gridSelected} aspect={heroAspect} onClose={() => setGridSelected(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Index view ───────────────────────────────────────────────────────────────


// Left padding of the index list (matches the nav's edge inset).
const INDEX_PAD_LEFT = 24;

function IndexView({
  boxes,
  onSelect,
}: {
  boxes: Box[];
  collected: Set<number>;
  onSelect: (b: Box, aspect: number) => void;
}) {
  // Align the title column under the nav's "Gallery/Index" tabs and the year
  // column under "Information" by measuring those nav elements directly. The
  // nav spacing is DialKit-tunable, so hardcoded widths would drift — this
  // reads the real positions (offsets are relative to the list's content box,
  // hence the INDEX_PAD_LEFT subtraction).
  const [titleX, setTitleX] = useState(280);
  const [yearX, setYearX] = useState(560);
  // Row under the cursor — drives the floating photo preview and dims the
  // rest of the list so the image reads against quieter text.
  const [hovered, setHovered] = useState<Box | null>(null);
  // True while the preview is handing off to the detail hero (row click):
  // its exit must be instant then, or a ghost card lingers fading at the
  // cursor while the hero morphs away — that read as flicker.
  const [handoff, setHandoff] = useState(false);
  // Hover is a mouse concept: on touch, a tap fires mouseenter before click,
  // which flashed the preview and left the tapped row stuck inverted. Gate
  // the whole hover layer (preview, dimming, springs) to fine pointers.
  const [canHover] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
  // Natural aspect (w/h) per image src, measured by the preview as photos
  // load. Row clicks read it so the detail hero opens at the same shape the
  // preview is showing — the layoutId morph is then a clean move+scale.
  const aspectCache = useRef(new Map<string, number>());
  useEffect(() => {
    const measure = () => {
      const gallery = document.getElementById("nav-gallery-tab");
      const info = document.getElementById("nav-info-tab");
      if (gallery) setTitleX(gallery.getBoundingClientRect().left - INDEX_PAD_LEFT);
      if (info) setYearX(info.getBoundingClientRect().left - INDEX_PAD_LEFT);
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("nav-info-x", measure as EventListener);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("nav-info-x", measure as EventListener);
    };
  }, []);

  return (
    <div
      className="index-scroll"
      onMouseLeave={() => setHovered(null)}
      style={{
        flex: 1,
        position: "relative",
        overflowY: "auto",
        background: BG_COLOR,
        padding: `clamp(56px, 12vh, 96px) 24px 80px ${INDEX_PAD_LEFT}px`,
      }}
    >
      {/* Dense text list — columns pinned to the nav tab positions above. */}
      <div>
        {boxes.map((box, i) => (
          <IndexRow
            key={box.id}
            box={box}
            index={i}
            titleX={titleX}
            yearX={yearX}
            dimmed={hovered !== null && hovered.id !== box.id}
            onHover={() => {
              if (!canHover) return;
              setHandoff(false);
              setHovered(box);
            }}
            onSelect={() => {
              const src = box.images?.[0];
              setHandoff(true);
              setHovered(null);
              onSelect(box, (src && aspectCache.current.get(src)) || 4 / 3);
            }}
          />
        ))}
      </div>

      {/* Floating photo preview, trailing the cursor — mouse only. Not
          mounting it on touch also skips its springs and the global
          mousemove listener entirely. */}
      {canHover && (
        <HoverPreview src={hovered?.images?.[0] ?? null} instantExit={handoff} aspectCache={aspectCache} />
      )}
    </div>
  );
}

// ─── HoverPreview ─────────────────────────────────────────────────────────────
// The index list's floating photo: trails the cursor on a spring, leans into
// the direction of travel (rotation from cursor velocity), and crossfades
// when the hovered row's photo changes. Position/rotation live entirely in
// motion values, so mouse movement never re-renders React.
//
// The card keeps each photo's real orientation: its box is sized from the
// image's natural aspect (longest edge capped at PREVIEW_MAX), so landscapes
// stay landscape. It also carries layoutId="index-hero", shared with the
// detail panel's hero — clicking a row morphs the floating preview smoothly
// into the opened hero instead of fading through black.

const PREVIEW_MAX = 300;

function HoverPreview({
  src,
  instantExit,
  aspectCache,
}: {
  src: string | null;
  // On row click the preview hands off to the detail hero (shared layoutId);
  // its own exit must vanish instantly or a ghost lingers at the cursor
  // fading while the hero morphs away.
  instantExit: boolean;
  aspectCache: React.MutableRefObject<Map<string, number>>;
}) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  // Springy trail; reduced motion gets a stiff, near-direct follow.
  const springCfg = reduce
    ? { stiffness: 1500, damping: 90 }
    : { stiffness: 350, damping: 30 };
  const x = useSpring(mx, springCfg);
  const y = useSpring(my, springCfg);
  // Lean with horizontal velocity, spring-smoothed so it settles gently.
  const vx = useVelocity(x);
  const rotateRaw = useTransform(vx, [-1200, 1200], reduce ? [0, 0] : [-8, 8], { clamp: true });
  const rotate = useSpring(rotateRaw, { stiffness: 200, damping: 22 });

  // Natural aspect (w/h) of the current photo, derived from the cache at
  // render time; onLoad below fills the cache and bumps `measured` so a
  // freshly loaded photo re-renders into its true shape (the layoutId spring
  // animates the size change).
  const [, setMeasured] = useState(0);
  const ratio = (src && aspectCache.current.get(src)) || 4 / 3;
  const w = ratio >= 1 ? PREVIEW_MAX : Math.round(PREVIEW_MAX * ratio);
  const h = ratio >= 1 ? Math.round(PREVIEW_MAX / ratio) : PREVIEW_MAX;

  // Track the cursor globally — the springs keep following even while the
  // preview is hidden, so it fades in already at the cursor instead of
  // flying across the screen from its last position. The vertical target is
  // clamped so a tall card centred on the cursor can't extend above/below
  // the viewport (that clipped the preview when hovering the first row).
  useEffect(() => {
    const margin = 24;
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      const half = h / 2;
      const minY = half + margin;
      const maxY = window.innerHeight - half - margin;
      my.set(Math.min(Math.max(e.clientY, minY), maxY));
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my, h]);

  return (
    <AnimatePresence custom={instantExit}>
      {src && (
        <motion.div
          variants={{
            hidden: { opacity: 0, scale: 0.92 },
            shown: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
            // Instant when handing off to the detail hero; soft fade on a
            // plain un-hover.
            exit: (instant: boolean) =>
              instant
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
          }}
          initial="hidden"
          animate="shown"
          exit="exit"
          style={{ position: "fixed", top: 0, left: 0, x, y, zIndex: 39, pointerEvents: "none" }}
        >
          <motion.div
            layoutId="index-hero"
            // Size changes (portrait ↔ landscape as rows swap) snap instantly —
            // animating them read as wobble. The click-morph into the detail
            // hero still animates: that layout animation runs on the hero
            // element, which carries its own spring transition.
            transition={{ layout: { duration: 0 } }}
            style={{
              position: "relative",
              width: w,
              height: h,
              marginLeft: -w / 2,
              marginTop: -h / 2,
              rotate,
              borderRadius: 4,
              overflow: "hidden",
              background: "#141414",
              boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
            }}
          >
            {/* Crossfade between rows' photos as the cursor sweeps the list. */}
            <AnimatePresence initial={false}>
              <motion.div
                key={src}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", inset: 0 }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="300px"
                  style={{ objectFit: "cover" }}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0) {
                      aspectCache.current.set(src, img.naturalWidth / img.naturalHeight);
                      setMeasured((n) => n + 1);
                    }
                  }}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IndexRow({
  box,
  index,
  titleX,
  yearX,
  dimmed,
  onHover,
  onSelect,
}: {
  box: Box;
  index: number;
  titleX: number;
  yearX: number;
  dimmed: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const cell: React.CSSProperties = {
    fontSize: 12,
    letterSpacing: tracking.normal,
    // colour comes from .index-row (and flips on hover via CSS) — an inline
    // colour here would override the :hover inversion.
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  return (
    <motion.button
      onClick={onSelect}
      onMouseEnter={onHover}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.012, 0.3), ease: "easeOut" }}
      style={{
        display: "grid",
        // Columns start exactly at the measured nav positions. No column-gap
        // (it would shift each start point); instead each cell reserves a
        // little right padding so text doesn't touch the next column.
        // number → artist(fills to titleX) → title(fills to yearX) → year
        gridTemplateColumns: `${Math.max(titleX, 120)}px ${Math.max(yearX - titleX, 100)}px 1fr`,
        alignItems: "baseline",
        // Bleeds past the list's own side padding so the hover fill (an
        // ::before with inset:0) reaches the true screen edges; the matching
        // horizontal padding keeps the text sitting exactly where it did.
        width: `calc(100% + ${INDEX_PAD_LEFT}px + 24px)`,
        marginLeft: -INDEX_PAD_LEFT,
        padding: `8px 24px 8px ${INDEX_PAD_LEFT}px`,
        boxSizing: "border-box",
        background: "none",
        border: "none",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        // Colour lives on .index-row so the hover inversion can flip it.
        // Dim everything except the hovered row (motion owns `opacity` for
        // the entrance stagger, so the dim rides on filter instead). This
        // inline transition overrides the class's, so re-declare color here.
        filter: dimmed ? "brightness(0.35)" : "brightness(1)",
        transition: "filter 0.25s ease, color 0.55s ease",
      } as React.CSSProperties}
      className="index-row"
    >
      {/* number + artist share the first column (number fixed, artist fills) */}
      <span style={{ display: "flex", gap: 16, minWidth: 0, paddingRight: 16 }}>
        <span style={{ ...cell, flexShrink: 0, width: 44 }}>{String(index + 1).padStart(3, "0")}</span>
        <span style={{ ...cell, textTransform: "uppercase" }}>{box.artist}</span>
      </span>
      <span style={{ ...cell, paddingRight: 16 }}>{box.title}</span>
      {/* uppercase so "Unknown" reads as UNKNOWN, matching the artist column */}
      <span style={{ ...cell, textTransform: "uppercase" }}>{formatYear(box.year)}</span>
    </motion.button>
  );
}

// ─── GridDetail ─────────────────────────────────────────────────────────────
// The grid's detail view, styled like the cylinder's: a dark floating panel
// on the right, a large hero image on the left, and a photo strip. The hero
// shares a layoutId with the clicked grid card's image, so Motion morphs it
// smoothly from its grid position into the hero spot (the same feel as the
// cylinder card flying into the carousel).

function GridDetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingBlock: 12, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
      <span style={{ flexShrink: 0, fontSize: 11, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{label}</span>
      <span style={{ fontSize: 13, lineHeight: leading.meta, letterSpacing: tracking.normal, color: "rgba(255,255,255,0.92)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function GridDetail({ box, aspect, onClose }: { box: Box; aspect: number; onClose: () => void }) {
  const photos = box.images ?? [];
  // Keyed by box.id at the call site, so this remounts (photoIndex resets to 0)
  // whenever a different box opens — no effect needed to reset it.
  const [photoIndex, setPhotoIndex] = useState(0);
  const heroSrc = photos[photoIndex] ?? photos[0] ?? "";

  // Get the floating nav (mascot + menu) out of the way while this is open.
  useHideNav(true);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    formatAddress(box.address) + ", Toronto, Ontario"
  )}`;

  // Movement/morph on screen → ease-in-out; backdrop fade paired at the same
  // timing. The hero's own position/size morph is Motion's layout spring.
  const EASE = [0.65, 0.05, 0.36, 1] as const;

  return (
    <>
      {/* Dimmed backdrop — click to close. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        onClick={onClose}
        className="detail-backdrop"
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      />

      {/* Hero image — shares layoutId "index-hero" with the index list's
          floating cursor preview, so opening a row morphs the small preview
          smoothly into this spot (move + expand) instead of a plain fade.
          The box is sized from the same measured aspect the preview used,
          so the morph is a clean translate/scale with no distortion. */}
      <div
        className="detail-hero-wrap"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          paddingLeft: 48,
          // clear the floating panel (min(38vw, 360px) wide + 16px inset)
          paddingRight: "calc(min(38vw, 360px) + 48px)",
          pointerEvents: "none",
        }}
      >
        <motion.div
          layoutId="index-hero"
          exit={{ opacity: 0 }}
          transition={{ type: "spring", visualDuration: 0.55, bounce: 0.12 }}
          className="detail-hero"
          style={{
            position: "relative",
            width: `min(100%, calc(76vh * ${aspect}))`,
            aspectRatio: String(aspect),
            // Exposed for the mobile stylesheet, which re-derives the hero's
            // width from a height cap instead of the desktop formula above.
            "--hero-aspect": String(aspect),
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
            background: "#141414",
            pointerEvents: "auto",
          } as React.CSSProperties}
        >
          {/* Low-res underlay: the same 300px variant the hover preview
              already loaded, so the morphing box shows the photo instantly
              instead of flashing dark while the hi-res copy fetches. */}
          <Image
            src={heroSrc}
            alt=""
            fill
            sizes="300px"
            style={{ objectFit: "cover" }}
          />
          <Image
            key={heroSrc}
            src={heroSrc}
            alt={box.title}
            fill
            sizes="60vw"
            style={{ objectFit: "cover" }}
          />
        </motion.div>
      </div>

      {/* Floating dark panel — same look as the cylinder's DetailPanel. */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="grid-detail-panel"
        style={{
          position: "absolute",
          top: 16, right: 16, bottom: 16,
          width: "min(38vw, 360px)",
          boxSizing: "border-box",
          display: "flex", flexDirection: "column",
          background: "rgba(8,8,8,0.72)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          overflowY: "auto",
        }}
      >
        {/* Close */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "16px 20px", flexShrink: 0 }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, padding: 0, borderRadius: "50%", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)", cursor: "pointer", outline: "none" }}
          >
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Caption + title */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 11, lineHeight: leading.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
              ({String(box.id).padStart(3, "0")}) {formatNeighbourhood(box.neighbourhood)}
            </span>
            <span style={{ fontSize: 18, lineHeight: leading.subtitle, letterSpacing: tracking.normal, textTransform: "uppercase", color: "#ffffff" }}>
              {box.title}
            </span>
          </div>

          {/* Description */}
          {box.description && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: leading.body, letterSpacing: tracking.normal, color: "rgba(255,255,255,0.7)", textWrap: "pretty" } as React.CSSProperties}>
              {box.description}
            </p>
          )}

          {/* Metadata */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <GridDetailRow label="Artist" value={box.artist} />
            <GridDetailRow label="Year" value={formatYear(box.year)} />
            <GridDetailRow label="Neighbourhood" value={formatNeighbourhood(box.neighbourhood)} />
            <GridDetailRow
              label="Location"
              value={
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.92)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {formatAddress(box.address)}
                  <span style={{ fontSize: 10, display: "inline-block", transform: "rotate(45deg) scaleX(-1)", lineHeight: 1 }}>↑</span>
                </a>
              }
            />
          </div>

          {/* Photo strip */}
          {photos.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 12, marginTop: -22, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <span style={{ fontSize: 11, lineHeight: leading.meta, letterSpacing: tracking.loose, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Photos</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {photos.map((src, i) => (
                  <div
                    key={src}
                    onClick={() => setPhotoIndex(i)}
                    style={{ width: 56, height: 56, flexShrink: 0, position: "relative", cursor: "pointer", outline: i === photoIndex ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.2)", outlineOffset: -1, opacity: i === photoIndex ? 1 : 0.65, transition: "opacity 0.15s ease" }}
                  >
                    <Image src={src} alt="" fill style={{ objectFit: "cover" }} sizes="56px" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

