"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use } from "react";
import { type Box } from "@/lib/data";
import { size, tracking } from "@/lib/typography";

const CollectionGallery3D = dynamic(() => import("../CollectionGallery3D"), { ssr: false });

const centeredFlex: React.CSSProperties = {
  height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
};

export default function PublicCollectionPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Box | null>(null);

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setBoxes(data.boxes); })
      .catch(() => setNotFound(true));
  }, [username]);

  if (notFound) {
    return (
      <div style={{ ...centeredFlex, flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA" }}>
          Collection not found
        </p>
        <Link href="/gallery" style={{ fontSize: size.caption, letterSpacing: tracking.label, textTransform: "uppercase", color: "#202020", textDecoration: "none", borderBottom: "1px solid #E8E8E8", paddingBottom: 2 }}>
          Browse the gallery →
        </Link>
      </div>
    );
  }

  if (!boxes) {
    return (
      <div style={centeredFlex}>
        <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA" }}>
          Loading…
        </span>
      </div>
    );
  }

  if (boxes.length === 0) {
    return (
      <div style={{ ...centeredFlex, flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA" }}>
          {username}'s collection is empty
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      {/* Byline */}
      <div style={{
        position: "absolute", top: 16, left: 20, zIndex: 10,
        fontSize: size.caption, letterSpacing: tracking.loose,
        textTransform: "uppercase", color: "#AAAAAA",
        fontFamily: '"Geist", system-ui, sans-serif',
        pointerEvents: "none",
      }}>
        {username}'s collection
      </div>

      <CollectionGallery3D boxes={boxes} onSelect={setSelected} />

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed", inset: 0,
            backgroundColor: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 20, cursor: "default",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: "#FFFFFF", border: "1px solid #C9C9C9",
            padding: 24, maxWidth: 480, width: "100%",
            fontFamily: '"Geist", system-ui, sans-serif',
          }}>
            <p style={{ margin: "0 0 8px", fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>
              {selected.title}
            </p>
            <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA" }}>
              Sign in to add to your collection
            </p>
            <Link href="/collection" style={{ display: "inline-block", marginTop: 16, fontSize: size.caption, letterSpacing: tracking.label, textTransform: "uppercase", color: "#202020", textDecoration: "none", borderBottom: "1px solid #E8E8E8", paddingBottom: 2 }}>
              Sign in →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
