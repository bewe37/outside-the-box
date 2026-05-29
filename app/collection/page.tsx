"use client";

import React, { useState, useEffect, useCallback } from "react";
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

const CollectionGallery3D = dynamic(() => import("./CollectionGallery3D"), { ssr: false });

const hasUpload = (b: Box) => !!(b.images && b.images.length > 0);

// ─── Page — only handles auth + data fetching ─────────────────────────────────

export default function CollectionPage() {
  const { user, session, loading, signIn, signOut, setCollectionCount } = useAuth();
  const [collected, setCollected] = useState<Set<number>>(new Set());
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
    supabase.from("collections").select("box_id").eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error) { setCollectionError(true); }
        else if (data) setCollected(new Set(data.map((r: { box_id: number }) => r.box_id)));
        setCollectionLoading(false);
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

  const collectedBoxes = allBoxes.filter((b) => collected.has(b.id));

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
      <div style={{ ...centeredFlex, flexDirection: "column", gap: 28 }}>
        <p style={emptyLabel}>Sign in to track your collection</p>
        <button onClick={signIn} style={ctaButton}>Sign in with Google →</button>
      </div>
    );
  }

  if (collectedBoxes.length === 0) {
    return (
      <div style={{ ...centeredFlex, flexDirection: "column", gap: 20 }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.18 }}>
          <rect x="6" y="6" width="20" height="20" rx="2" stroke="#202020" strokeWidth="1.5" />
          <path d="M11 16h10M16 11v10" stroke="#202020" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p style={emptyLabel}>Nothing collected yet</p>
        <Link href="/gallery" style={ctaButton}>Browse the gallery →</Link>
        <button onClick={signOut} style={signOutButton}>Sign out</button>
      </div>
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
      <CollectionGallery3D boxes={collectedBoxes} onSelect={handleSelect} userPhotos={userPhotos} />

      {/* Share + sign out */}
      <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 10, display: "flex", gap: 8 }}>
        <button onClick={() => setShowShareModal(true)} style={shareBtnStyle}>Share</button>
        <button onClick={signOut} style={signOutBtnStyle}>Sign out</button>
      </div>

      {/* Share modal */}
      <AnimatePresence>
        {showShareModal && (
          <>
            <motion.div key="share-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setShowShareModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 30 }} />
            <motion.div key="share-panel" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }} onClick={(e) => e.stopPropagation()} style={{ position: "fixed", top: "50%", left: "50%", translate: "-50% -50%", zIndex: 31, width: "min(400px, calc(100vw - 32px))", backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", padding: 24, fontFamily: '"Geist", system-ui, sans-serif', display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: size.meta, letterSpacing: tracking.label, textTransform: "uppercase", color: "#202020", fontWeight: 500 }}>Share your collection</p>
                  <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>Anyone with the link can view your collection</p>
                </div>
                <button onClick={() => setShowShareModal(false)} className="close-btn" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1, flexShrink: 0, marginLeft: 12 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {username ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #E8E8E8", padding: "8px 12px" }}>
                    <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, color: "#202020", fontFamily: "inherit" }}>/collection/{username}</span>
                    <button onClick={copyLink} style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: copied ? "#AAAAAA" : "#202020", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, transition: "color 0.15s ease" }}>{copied ? "Copied" : "Copy"}</button>
                  </div>
                  <button onClick={() => { setUsernameInput(username); setUsername(null); }} style={signOutButton}>Change username</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>Choose a username for your public link</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={usernameInput} onChange={(e) => { setUsernameInput(e.target.value); setUsernameError(""); }} onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }} placeholder="e.g. alex" style={{ flex: 1, border: "1px solid #E8E8E8", padding: "8px 10px", fontSize: size.caption, letterSpacing: tracking.loose, fontFamily: "inherit", outline: "none", borderColor: usernameError ? "#E05252" : "#E8E8E8" }} />
                    <button onClick={saveUsername} disabled={usernameLoading || !usernameInput.trim()} style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", fontFamily: "inherit", color: "#FFFFFF", background: "#202020", border: "none", padding: "8px 16px", cursor: usernameLoading ? "default" : "pointer", opacity: usernameLoading || !usernameInput.trim() ? 0.4 : 1 }}>{usernameLoading ? "…" : "Save"}</button>
                  </div>
                  {usernameError && <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#E05252" }}>{usernameError}</p>}
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
              <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 50, cursor: "default" }} />
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
                  userPhoto={userPhotos[selected.id]}
                  onSwapPhoto={(file) => swapPhoto(selected.id, file)}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const centeredFlex: React.CSSProperties = {
  height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
};

const emptyLabel: React.CSSProperties = {
  margin: 0, fontSize: size.caption, lineHeight: leading.caption,
  letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA",
};

const ctaButton: React.CSSProperties = {
  fontSize: size.caption, lineHeight: leading.caption, letterSpacing: tracking.label,
  fontWeight: weight.medium, textTransform: "uppercase", color: "#202020",
  background: "none", border: "none", borderBottom: "1px solid #E8E8E8",
  paddingBottom: 2, cursor: "pointer", fontFamily: "inherit", textDecoration: "none",
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
