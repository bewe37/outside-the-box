"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: size.caption, letterSpacing: tracking.label,
        textTransform: "uppercase", color: "#202020",
        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
      }}
    >
      {children}
      <span style={{
        display: "inline-block",
        transform: hovered ? "translate(2px, -2px)" : "translate(0, 0)",
        transition: "transform 0.15s ease",
      }}>→</span>
    </Link>
  );
}
import { type Box } from "@/lib/data";
import { size, tracking } from "@/lib/typography";
import { useAuth } from "@/app/components/auth-context";
import { supabase } from "@/lib/supabase";

const CollectionGallery3D = dynamic(() => import("../CollectionGallery3D"), { ssr: false });

const centeredFlex: React.CSSProperties = {
  height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
};

export default function PublicCollectionPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Box | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // If signed in, check if this is their own collection and redirect if so
  useEffect(() => {
    if (authLoading || !user) return;
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username === username) {
          router.replace("/collection");
        } else {
          setIsOwner(false);
        }
      });
  }, [user, authLoading, username, router]);

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
      <CollectionGallery3D boxes={boxes} onSelect={setSelected} />

      {/* Viewer banner — shown to everyone since owner gets redirected */}
      <div style={{
        position: "absolute", bottom: 20, left: 20, zIndex: 10,
        display: "flex", alignItems: "center", gap: 16,
        fontFamily: '"Geist", system-ui, sans-serif',
      }}>
        <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>
          {username}'s collection
        </span>
        <ArrowLink href="/collection">
          {user ? "Go to yours" : "Start yours"}
        </ArrowLink>
      </div>

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
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#AAAAAA" }}>
              {selected.title}
            </p>
            <p style={{ margin: 0, fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#CACACA" }}>
              {user ? "Add this to your collection" : "Sign in to start your own collection"}
            </p>
            <Link
              href="/collection"
              style={{ fontSize: size.caption, letterSpacing: tracking.label, textTransform: "uppercase", color: "#202020", textDecoration: "none", borderBottom: "1px solid #E8E8E8", paddingBottom: 2, width: "fit-content" }}
            >
              {user ? "Go to your collection →" : "Sign in →"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
