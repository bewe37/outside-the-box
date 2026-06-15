"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { boxes, type Box } from "@/lib/data";
import { size, tracking, weight, leading } from "@/lib/typography";
import { useAuth } from "@/app/components/auth-context";
import { supabase } from "@/lib/supabase";
import { DetailPanel } from "@/app/components/DetailPanel";
import { Toast } from "@/app/components/Toast";
import type { Session } from "@supabase/supabase-js";

const CollectionStrip = dynamic(() => import("./CollectionStrip"), { ssr: false });

const hasUpload = (b: Box) => !!(b.images && b.images.length > 0);

// ─── Page — only handles auth + data fetching ─────────────────────────────────

export default function CollectionPage() {
  const { user, session, loading, signIn, signOut, setCollectionCount } = useAuth();
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [collectedOrder, setCollectedOrder] = useState<number[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionError, setCollectionError] = useState(false);
  const [toast, setToast] = useState("");
  const [allBoxes, setAllBoxes] = useState<Box[]>(() => boxes.filter(hasUpload));
  const [userPhotos, setUserPhotos] = useState<Record<number, string>>({});
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/boxes")
      .then((r) => r.json())
      .then((extra: Box[]) => setAllBoxes([...boxes, ...extra].filter(hasUpload)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setCollected(new Set()); setUsername(null); setUserPhotos({}); setCollectionLoading(false); return; }
    setCollectionLoading(true);
    supabase.from("collections").select("box_id, created_at").eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error) {
          // Fallback: try without created_at in case column doesn't exist
          supabase.from("collections").select("box_id").eq("user_id", user.id)
            .then(({ data: data2, error: error2 }) => {
              if (error2) { setCollectionError(true); }
              else if (data2) {
                const ids = data2.map((r: { box_id: number }) => r.box_id);
                setCollected(new Set(ids));
                setCollectedOrder(ids);
              }
              setCollectionLoading(false);
            });
        } else if (data) {
          const sorted = [...data].sort((a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
          );
          setCollected(new Set(sorted.map((r: { box_id: number }) => r.box_id)));
          setCollectedOrder(sorted.map((r: { box_id: number }) => r.box_id));
          setCollectionLoading(false);
        }
      });
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [user]);

  useEffect(() => {
    if (!session || collected.size === 0) return;
    const ids = Array.from(collected).join(",");
    fetch(`/api/user-photo?box_ids=${ids}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((map: Record<string, string>) => {
        const typed: Record<number, string> = {};
        Object.entries(map).forEach(([k, v]) => { typed[Number(k)] = v; });
        setUserPhotos(typed);
      })
      .catch(() => {});
  }, [session, collected]);

  const collectedBoxes = collectedOrder
    .map((id) => allBoxes.find((b) => b.id === id))
    .filter((b): b is Box => b !== undefined);

  async function toggleCollect(id: number) {
    if (!user) return;
    const isCollected = collected.has(id);
    setCollected((prev) => { const next = new Set(prev); if (isCollected) next.delete(id); else next.add(id); return next; });
    setCollectionCount((prev) => isCollected ? prev - 1 : prev + 1);
    const { error } = isCollected
      ? await supabase.from("collections").delete().match({ user_id: user.id, box_id: id })
      : await supabase.from("collections").insert({ user_id: user.id, box_id: id });
    if (error) {
      setCollected((prev) => { const next = new Set(prev); if (isCollected) next.add(id); else next.delete(id); return next; });
      setCollectionCount((prev) => isCollected ? prev + 1 : prev - 1);
      setToast("Couldn't update collection — try again");
    }
  }

  async function swapPhoto(boxId: number, file: File) {
    if (!session) return;
    const form = new FormData();
    form.append("file", file);
    form.append("box_id", String(boxId));
    try {
      const res = await fetch("/api/user-photo", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      const data = await res.json();
      if (res.ok && data.url) {
        setUserPhotos((prev) => ({ ...prev, [boxId]: data.url }));
      } else {
        setToast(data.error ?? "Photo upload failed — try again");
      }
    } catch {
      setToast("Photo upload failed — check your connection");
    }
  }

  if (loading || collectionLoading) {
    return (
      <div style={centeredFlex}>
        <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA" }}>Loading…</span>
      </div>
    );
  }

  if (collectionError) {
    return (
      <div style={{ ...centeredFlex, flexDirection: "column", gap: 16 }}>
        <p style={emptyLabel}>Couldn't load your collection</p>
        <button onClick={() => window.location.reload()} style={ctaButton}>Try again →</button>
      </div>
    );
  }

  if (!user) {
    return (
      <BoxState label="Start your collection">
        <SignInButton onClick={signIn} />
      </BoxState>
    );
  }

  if (collectedBoxes.length === 0) {
    return (
      <BoxState label="Your collection is empty">
        <BrowseButton />
      </BoxState>
    );
  }

  return (
    <>
      <AnimatePresence>
        {toast && <Toast key={toast} message={toast} onDone={() => setToast("")} />}
      </AnimatePresence>
      <CollectionView
        collectedBoxes={collectedBoxes}
        collected={collected}
        userPhotos={userPhotos}
        username={username}
        setUsername={setUsername}
        session={session}
        signOut={signOut}
        toggleCollect={toggleCollect}
        swapPhoto={swapPhoto}
      />
    </>
  );
}

// ─── CollectionView ───────────────────────────────────────────────────────────
// All overlay state (lightbox, share modal) lives here — completely isolated
// from CollectionPage so the canvas never re-renders when overlays open/close.

function CollectionView({
  collectedBoxes, collected, userPhotos, username, setUsername,
  session, signOut, toggleCollect, swapPhoto,
}: {
  collectedBoxes: Box[];
  collected: Set<number>;
  userPhotos: Record<number, string>;
  username: string | null;
  setUsername: (u: string | null) => void;
  session: Session | null;
  signOut: () => void;
  toggleCollect: (id: number) => void;
  swapPhoto: (id: number, file: File) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Box | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSelect = useCallback((box: Box) => setSelected(box), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showShareModal) { setShowShareModal(false); return; }
        setSelected(null); return;
      }
      if (!selected) return;
      const i = collectedBoxes.findIndex((b) => b.id === selected.id);
      if (e.key === "ArrowLeft" && i > 0) setSelected(collectedBoxes[i - 1]);
      if (e.key === "ArrowRight" && i < collectedBoxes.length - 1) setSelected(collectedBoxes[i + 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, collectedBoxes, showShareModal]);

  async function saveUsername() {
    if (!session) return;
    setUsernameLoading(true); setUsernameError("");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ username: usernameInput.trim().toLowerCase() }),
    });
    const data = await res.json();
    setUsernameLoading(false);
    if (!res.ok) { setUsernameError(data.error); return; }
    setUsername(data.username);
  }

  function copyLink() {
    if (!username) return;
    navigator.clipboard.writeText(`${window.location.origin}/collection/${username}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <CollectionStrip boxes={collectedBoxes} onSelect={handleSelect} userPhotos={userPhotos} />

      {/* Share + sign out */}
      <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 10, display: "flex", gap: 8 }}>
        <HoverPillBtn onClick={() => setShowShareModal(true)}>Share</HoverPillBtn>
        <HoverPillBtn onClick={signOut} muted>Sign out</HoverPillBtn>
      </div>

      {/* Share modal */}
      <AnimatePresence>
        {showShareModal && (
          <>
            <motion.div key="share-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setShowShareModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 30 }} />
            <motion.div key="share-panel" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }} onClick={(e) => e.stopPropagation()} style={{ position: "fixed", top: "50%", left: "50%", translate: "-50% -50%", zIndex: 31, width: "min(420px, calc(100vw - 32px))", backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", padding: 16, fontFamily: '"Geist", system-ui, sans-serif', display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: size.body, letterSpacing: tracking.normal, color: "#202020", fontWeight: 500 }}>Share your collection</p>
                  <p style={{ margin: 0, fontSize: size.meta, letterSpacing: tracking.normal, color: "#AAAAAA" }}>Anyone with the link can view your collection</p>
                </div>
                <button onClick={() => setShowShareModal(false)} className="close-btn" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1, flexShrink: 0, marginLeft: 12 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {username ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #E8E8E8", padding: "10px 14px" }}>
                    <span style={{ fontSize: size.meta, letterSpacing: tracking.normal, color: "#202020", fontFamily: "inherit" }}>/collection/{username}</span>
                    <button onClick={copyLink} style={{ fontSize: size.meta, letterSpacing: tracking.normal, color: copied ? "#AAAAAA" : "#202020", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, transition: "color 0.15s ease", marginLeft: 12, flexShrink: 0 }}>{copied ? "Copied" : "Copy"}</button>
                  </div>
                  <button onClick={() => { setUsernameInput(username); setUsername(null); }} style={signOutButton}>Change username</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.normal, color: "#AAAAAA" }}>Choose a username for your public link</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={usernameInput} onChange={(e) => { setUsernameInput(e.target.value); setUsernameError(""); }} onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }} placeholder="e.g. alex" style={{ flex: 1, border: "1px solid #E8E8E8", padding: "10px 12px", fontSize: size.meta, letterSpacing: tracking.normal, fontFamily: "inherit", outline: "none", borderColor: usernameError ? "#E05252" : "#E8E8E8" }} />
                    <button onClick={saveUsername} disabled={usernameLoading || !usernameInput.trim()} style={{ fontSize: size.caption, letterSpacing: tracking.normal, fontFamily: "inherit", color: "#FFFFFF", background: "#202020", border: "none", padding: "10px 18px", cursor: usernameLoading ? "default" : "pointer", opacity: usernameLoading || !usernameInput.trim() ? 0.4 : 1 }}>{usernameLoading ? "…" : "Save"}</button>
                  </div>
                  {usernameError && <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.normal, color: "#E05252" }}>{usernameError}</p>}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (() => {
          const i = collectedBoxes.findIndex((b) => b.id === selected.id);
          return (
            <>
              <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, backgroundColor: "#FFFFFF", zIndex: 50, cursor: "default" }} />
              <motion.div key="panel" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }} className="lightbox-modal" style={{ position: "fixed", zIndex: 51 }}>
                <DetailPanel
                  box={selected}
                  displayNumber={i + 1}
                  isCollected={collected.has(selected.id)}
                  onCollect={() => toggleCollect(selected.id)}
                  onPrev={() => { if (i > 0) setSelected(collectedBoxes[i - 1]); }}
                  onNext={() => { if (i < collectedBoxes.length - 1) setSelected(collectedBoxes[i + 1]); }}
                  hasPrev={i > 0}
                  hasNext={i < collectedBoxes.length - 1}
                  onClose={() => setSelected(null)}
                  capturedLabel="COLLECTED"
                />
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

function BrowseButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href="/gallery"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: size.caption, lineHeight: leading.caption, letterSpacing: tracking.loose,
        textTransform: "uppercase", fontWeight: weight.medium, color: "#202020",
        background: hovered ? "#F4F4F4" : "transparent", border: "1px solid #202020",
        padding: "6px 14px", fontFamily: "inherit", textDecoration: "none",
        display: "inline-block", transition: "background 0.15s ease",
      }}
    >
      Browse the gallery →
    </Link>
  );
}

function SignInButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: size.caption, lineHeight: leading.caption, letterSpacing: tracking.loose,
        textTransform: "uppercase", fontWeight: weight.medium, color: "#202020",
        background: hovered ? "#F4F4F4" : "none", border: "1px solid #202020",
        padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
        transition: "background 0.15s ease",
      }}
    >
      Sign in with Google →
    </button>
  );
}

// ─── Box State (sign-in + empty collection) ───────────────────────────────────

function BoxState({ label, children }: { label: string; children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  // eyeScale: 1 = open, 0 = closed
  const [eyeScale, setEyeScale] = useState(1);

  useEffect(() => {
    setReady(true);
    function onMove(e: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMouse({
        x: ((e.clientX - rect.left) / rect.width  - 0.5) * 2,
        y: ((e.clientY - rect.top)  / rect.height - 0.5) * 2,
      });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    function doBlink(onDone: () => void) {
      // close fast (60ms), open slower (160ms)
      setEyeScale(0);
      setTimeout(() => {
        setEyeScale(1);
        setTimeout(onDone, 160);
      }, 60);
    }

    function scheduleBlink() {
      const delay = 2000 + Math.random() * 4000;
      blinkTimer.current = setTimeout(() => {
        const doDouble = Math.random() < 0.25;
        doBlink(() => {
          if (doDouble) {
            setTimeout(() => doBlink(() => { scheduleBlink(); }), 120);
          } else {
            scheduleBlink();
          }
        });
      }, delay);
    }

    scheduleBlink();
    return () => clearTimeout(blinkTimer.current);
  }, []);
  const blinkTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const MAX = 5;
  const px = mouse.x * MAX;
  const py = mouse.y * MAX;

  const BOX_W = 120;
  const BOX_H = Math.round(BOX_W * 1251 / 883);
  const EYE_R = 8;
  const PUPIL_R = 3.5;
  const HIGHLIGHT_R = 1.2;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ position: "relative", width: BOX_W, height: BOX_H, userSelect: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/BeforeLoading.svg" alt="" style={{ width: "100%", height: "100%", display: "block" }} />
        {ready && (
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
            viewBox={`0 0 ${BOX_W} ${BOX_H}`}
          >
            {[0.35, 0.65].map((ex, i) => {
              const ey = BOX_H * 0.37;
              const cx = BOX_W * ex;
              // transition differs on close vs open so we key off eyeScale
              const transitionDuration = eyeScale === 0 ? "60ms" : "160ms";
              return (
                <g key={i} style={{ transformOrigin: `${cx}px ${ey}px`, transform: `scaleY(${eyeScale})`, transition: `transform ${transitionDuration} ease-in-out` }}>
                  <circle cx={cx} cy={ey} r={EYE_R} fill="#FFFFFF" stroke="#D0D0D0" strokeWidth={0.5} />
                  <circle cx={cx + px} cy={ey + py} r={PUPIL_R} fill="#10100F" />
                  <circle cx={cx + px + 1.2} cy={ey + py - 1.5} r={HIGHLIGHT_R} fill="#FFFFFF" />
                </g>
              );
            })}
            <path
              d={`M ${BOX_W * 0.42} ${BOX_H * 0.45} Q ${BOX_W * 0.50} ${BOX_H * 0.475} ${BOX_W * 0.58} ${BOX_H * 0.45}`}
              stroke="#9A9A9A"
              strokeWidth={1.5}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
      >
        <p style={emptyLabel}>{label}</p>
        {children}
      </motion.div>
    </div>
  );
}

function HoverPillBtn({ children, onClick, muted = false }: { children: React.ReactNode; onClick: () => void; muted?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase",
        fontFamily: "inherit", cursor: "pointer",
        background: hovered ? "#F4F4F4" : "#FFFFFF",
        border: "1px solid #E8E8E8",
        padding: "7px 14px",
        color: muted ? (hovered ? "#202020" : "#AAAAAA") : "#202020",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const centeredFlex: React.CSSProperties = {
  height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
};

const emptyLabel: React.CSSProperties = {
  margin: 0, fontSize: size.meta, lineHeight: leading.meta,
  letterSpacing: tracking.normal, color: "#202020", fontWeight: weight.medium,
};

const ctaButton: React.CSSProperties = {
  fontSize: size.caption, lineHeight: leading.caption, letterSpacing: tracking.loose,
  textTransform: "uppercase", fontWeight: weight.medium, color: "#202020",
  background: "none", border: "1px solid #202020",
  padding: "6px 14px",
  cursor: "pointer", fontFamily: "inherit", textDecoration: "none",
};

const signOutButton: React.CSSProperties = {
  fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase",
  color: "#CACACA", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0,
};

const shareBtnStyle: React.CSSProperties = {
  fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase",
  fontFamily: "inherit", color: "#202020", background: "#FFFFFF",
  border: "1px solid #E8E8E8", padding: "7px 14px", cursor: "pointer",
};

const signOutBtnStyle: React.CSSProperties = {
  fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase",
  fontFamily: "inherit", color: "#AAAAAA", background: "#FFFFFF",
  border: "1px solid #E8E8E8", padding: "7px 14px", cursor: "pointer",
};
