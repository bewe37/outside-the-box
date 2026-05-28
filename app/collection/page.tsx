"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { boxes, type Box } from "@/lib/data";
import { size, tracking, weight, leading } from "@/lib/typography";
import { useAuth } from "@/app/components/auth-context";
import { supabase } from "@/lib/supabase";
import { DetailPanel } from "@/app/components/DetailPanel";

const CollectionGallery3D = dynamic(() => import("./CollectionGallery3D"), { ssr: false });

const hasUpload = (b: Box) => !!(b.images && b.images.length > 0);

export default function CollectionPage() {
  const { user, session, loading, signIn, signOut } = useAuth();
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [allBoxes, setAllBoxes] = useState<Box[]>(() => boxes.filter(hasUpload));
  const [selected, setSelected] = useState<Box | null>(null);

  // Share state
  const [username, setUsername] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/boxes")
      .then((r) => r.json())
      .then((extra: Box[]) => setAllBoxes([...boxes, ...extra].filter(hasUpload)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setCollected(new Set()); setUsername(null); return; }
    supabase
      .from("collections")
      .select("box_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setCollected(new Set(data.map((r: { box_id: number }) => r.box_id)));
      });
    // Load existing username
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [user]);

  const collectedBoxes = allBoxes.filter((b) => collected.has(b.id));

  async function toggleCollect(id: number) {
    if (!user) return;
    const isCollected = collected.has(id);
    setCollected((prev) => {
      const next = new Set(prev);
      if (isCollected) next.delete(id); else next.add(id);
      return next;
    });
    if (isCollected) {
      await supabase.from("collections").delete().match({ user_id: user.id, box_id: id });
    } else {
      await supabase.from("collections").insert({ user_id: user.id, box_id: id });
    }
  }

  async function saveUsername() {
    if (!session) return;
    setUsernameLoading(true);
    setUsernameError("");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showShareModal) { setShowShareModal(false); return; }
        setSelected(null);
        return;
      }
      if (!selected) return;
      const i = collectedBoxes.findIndex((b) => b.id === selected.id);
      if (e.key === "ArrowLeft" && i > 0) setSelected(collectedBoxes[i - 1]);
      if (e.key === "ArrowRight" && i < collectedBoxes.length - 1) setSelected(collectedBoxes[i + 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, collectedBoxes, showShareModal]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={centeredFlex}>
        <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA" }}>
          Loading…
        </span>
      </div>
    );
  }

  // ── Signed out ───────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ ...centeredFlex, flexDirection: "column", gap: 28 }}>
        <p style={emptyLabel}>Sign in to track your collection</p>
        <button onClick={signIn} style={ctaButton}>Sign in with Google →</button>
      </div>
    );
  }

  // ── Signed in, empty collection ──────────────────────────────────────────────
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

  const shareUrl = username ? `${typeof window !== "undefined" ? window.location.origin : ""}/collection/${username}` : null;

  // ── Signed in, has collection ────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <CollectionGallery3D boxes={collectedBoxes} onSelect={setSelected} />

      {/* Share + sign out — bottom right */}
      <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 10, display: "flex", gap: 8 }}>
        <button
          onClick={() => setShowShareModal(true)}
          style={{
            fontSize: size.caption, letterSpacing: tracking.loose,
            textTransform: "uppercase", fontFamily: "inherit",
            color: "#202020", background: "#FFFFFF",
            border: "1px solid #E8E8E8", padding: "7px 14px",
            cursor: "pointer",
          }}
        >
          Share
        </button>
        <button
          onClick={signOut}
          style={{
            fontSize: size.caption, letterSpacing: tracking.loose,
            textTransform: "uppercase", fontFamily: "inherit",
            color: "#AAAAAA", background: "#FFFFFF",
            border: "1px solid #E8E8E8", padding: "7px 14px",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>

      {/* Share modal */}
      <AnimatePresence>
        {showShareModal && (
          <>
            <motion.div
              key="share-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setShowShareModal(false)}
              style={{ position: "fixed", inset: 0, backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 30 }}
            />
            <motion.div
              key="share-panel"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed", top: "50%", left: "50%", translate: "-50% -50%", zIndex: 31,
                width: 380, backgroundColor: "#FFFFFF", border: "1px solid #C9C9C9",
                padding: 24, fontFamily: '"Geist", system-ui, sans-serif',
                display: "flex", flexDirection: "column", gap: 20,
              }}
            >
              <div>
                <p style={{ margin: "0 0 4px", fontSize: size.meta, letterSpacing: tracking.label, textTransform: "uppercase", color: "#202020" }}>
                  Share your collection
                </p>
                <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>
                  Anyone with the link can view your collection
                </p>
              </div>

              {username ? (
                // Already has a username — show the link
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    border: "1px solid #E8E8E8", padding: "8px 12px",
                  }}>
                    <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, color: "#202020", fontFamily: "inherit" }}>
                      /collection/{username}
                    </span>
                    <button
                      onClick={copyLink}
                      style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: copied ? "#AAAAAA" : "#202020", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <button
                    onClick={() => { setUsernameInput(username); setUsername(null); }}
                    style={signOutButton}
                  >
                    Change username
                  </button>
                </div>
              ) : (
                // Needs to pick a username
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>
                    Choose a username for your public link
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={usernameInput}
                      onChange={(e) => { setUsernameInput(e.target.value); setUsernameError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }}
                      placeholder="e.g. alex"
                      style={{
                        flex: 1, border: "1px solid #E8E8E8", padding: "8px 10px",
                        fontSize: size.caption, letterSpacing: tracking.loose,
                        fontFamily: "inherit", outline: "none",
                        borderColor: usernameError ? "#E05252" : "#E8E8E8",
                      }}
                    />
                    <button
                      onClick={saveUsername}
                      disabled={usernameLoading || !usernameInput.trim()}
                      style={{
                        fontSize: size.caption, letterSpacing: tracking.loose,
                        textTransform: "uppercase", fontFamily: "inherit",
                        color: "#FFFFFF", background: "#202020",
                        border: "none", padding: "8px 16px",
                        cursor: usernameLoading ? "default" : "pointer",
                        opacity: usernameLoading || !usernameInput.trim() ? 0.4 : 1,
                      }}
                    >
                      {usernameLoading ? "…" : "Save"}
                    </button>
                  </div>
                  {usernameError && (
                    <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#E05252" }}>
                      {usernameError}
                    </p>
                  )}
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
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelected(null)}
                style={{ position: "fixed", inset: 0, backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 20, cursor: "default" }}
              />
              <motion.div
                key="panel"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ position: "fixed", top: "50%", left: "50%", translate: "-50% -50%", zIndex: 21 }}
              >
                <DetailPanel
                  box={selected}
                  displayNumber={i + 1}
                  isCollected={collected.has(selected.id)}
                  onCollect={() => toggleCollect(selected.id)}
                  onPrev={() => { if (i > 0) setSelected(collectedBoxes[i - 1]); }}
                  onNext={() => { if (i < collectedBoxes.length - 1) setSelected(collectedBoxes[i + 1]); }}
                  hasPrev={i > 0}
                  hasNext={i < collectedBoxes.length - 1}
                />
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

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
  color: "#CACACA", background: "none", border: "none",
  cursor: "pointer", fontFamily: "inherit", padding: 0,
};
