"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Script from "next/script";
import { AnimatePresence, motion } from "motion/react";
import { boxes, formatNeighbourhood, type Box } from "@/lib/data";
import { size, tracking, weight, leading } from "@/lib/typography";

const BLUR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23E8E8E8"/></svg>';
const MAPS_KEY = "AIzaSyCZjNyrfN8BznNdDODCjF8ZvUnzzXFjKW0";

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function buildRoute(
  origin: { lat: number; lng: number },
  candidates: (Box & { lat: number; lng: number })[],
  budgetM: number
): (Box & { lat: number; lng: number })[] {
  const route: (Box & { lat: number; lng: number })[] = [];
  const remaining = [...candidates];
  let current = origin;
  let used = 0;
  while (remaining.length > 0 && route.length < 8) {
    let bestIdx = -1, bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = dist(current, remaining[i]);
      if (d < bestDist && used + d <= budgetM) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    route.push(remaining[bestIdx]);
    used += bestDist;
    current = remaining[bestIdx];
    remaining.splice(bestIdx, 1);
  }
  return route;
}

function mapsUrl(origin: { lat: number; lng: number }, route: (Box & { lat: number; lng: number })[]): string {
  if (route.length === 0) return "";
  const dest = route[route.length - 1];
  const waypoints = route.slice(0, -1).map((b) => `${b.lat},${b.lng}`).join("|");
  const params = [
    `origin=${origin.lat},${origin.lng}`,
    `destination=${dest.lat},${dest.lng}`,
    waypoints ? `waypoints=${encodeURIComponent(waypoints)}` : "",
    `travelmode=walking`,
  ].filter(Boolean).join("&");
  return `https://www.google.com/maps/dir/?api=1&${params}`;
}

const KM_OPTIONS = [1, 2, 3, 5];
const boxesWithCoords = boxes.filter((b): b is Box & { lat: number; lng: number } =>
  b.lat !== undefined && b.lng !== undefined
);

export default function WalkPage() {
  const [km, setKm] = useState(2);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [route, setRoute] = useState<(Box & { lat: number; lng: number })[] | null>(null);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState<Box | null>(null);
  const [rowTop, setRowTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function initAutocomplete() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    if (!inputRef.current || !g) return;
    const ac = new g.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "ca" },
      fields: ["geometry"],
      types: ["geocode"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;
      const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      setOrigin(loc);
      setError("");
      setRoute(buildRoute(loc, boxesWithCoords, km * 1000));
    });
  }

  useEffect(() => {
    if (origin) setRoute(buildRoute(origin, boxesWithCoords, km * 1000));
  }, [km, origin]);

  function handleGPS() {
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(loc);
        setRoute(buildRoute(loc, boxesWithCoords, km * 1000));
        setLoading(false);
        if (inputRef.current) inputRef.current.value = "Current location";
      },
      () => { setError("Couldn't get your location."); setLoading(false); }
    );
  }

  function handleRowEnter(box: Box, e: React.MouseEvent) {
    const container = containerRef.current;
    if (!container) return;
    const rowRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setRowTop(rowRect.top - containerRect.top + container.scrollTop);
    setHovered(box);
  }

  const url = origin && route ? mapsUrl(origin, route) : "";
  const totalDist = route && origin
    ? (() => { let d = 0, cur = origin; for (const b of route) { d += dist(cur, b); cur = b; } return d; })()
    : 0;

  const PREVIEW_W = 200;
  const PREVIEW_H = 260;

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`}
        onLoad={initAutocomplete}
      />

      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: '"Geist", system-ui, sans-serif',
          color: "#202020",
          backgroundColor: "#FFFFFF",
        }}
      >
        <div ref={containerRef} style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <div style={{ maxWidth: 560, padding: "40px 20px 80px" }}>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40, flexWrap: "wrap" }}>
              {/* Address input */}
              <div style={{ display: "flex", gap: 0, flex: 1, minWidth: 200 }}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Starting address"
                  style={{
                    flex: 1,
                    fontSize: size.meta,
                    lineHeight: leading.meta,
                    letterSpacing: tracking.normal,
                    padding: "9px 12px",
                    border: "1px solid #E8E8E8",
                    borderRight: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    color: "#202020",
                  }}
                />
                <button
                  onClick={handleGPS}
                  disabled={loading}
                  title="Use my location"
                  style={{
                    padding: "9px 12px",
                    border: "1px solid #E8E8E8",
                    background: "none",
                    cursor: "pointer",
                    fontSize: size.meta,
                    fontFamily: "inherit",
                    color: "#A8A8A8",
                  }}
                >
                  ◎
                </button>
              </div>

              {/* Distance chips */}
              <div style={{ display: "flex", gap: 4 }}>
                {KM_OPTIONS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKm(k)}
                    style={{
                      padding: "8px 12px",
                      fontSize: size.caption,
                      letterSpacing: tracking.loose,
                      textTransform: "uppercase",
                      fontFamily: "inherit",
                      border: "1px solid #E8E8E8",
                      background: km === k ? "#202020" : "none",
                      color: km === k ? "#FFFFFF" : "#202020",
                      cursor: "pointer",
                    }}
                  >
                    {k}km
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ fontSize: size.meta, letterSpacing: tracking.normal, marginBottom: 24 }}>
                {error}
              </div>
            )}

            {/* Results */}
            {route !== null && (
              route.length === 0 ? (
                <div style={{ fontSize: size.meta, letterSpacing: tracking.normal, color: "#A8A8A8" }}>
                  No boxes within {km}km — try a larger distance.
                </div>
              ) : (
                <>
                  {/* Summary line */}
                  <div style={{ display: "flex", gap: 24, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #E8E8E8" }}>
                    {[
                      { value: String(route.length), label: route.length === 1 ? "Box" : "Boxes" },
                      { value: `${(totalDist / 1000).toFixed(1)}km`, label: "Distance" },
                      { value: `~${Math.round(totalDist / 80)}min`, label: "Walk" },
                    ].map(({ value, label }) => (
                      <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: size.title, letterSpacing: tracking.tight, fontWeight: weight.medium, lineHeight: 1 }}>{value}</span>
                        <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#A8A8A8" }}>{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Route list */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {route.map((box, i) => (
                      <div key={box.id}>
                        <div
                          onMouseEnter={(e) => handleRowEnter(box, e)}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            paddingBlock: 10,
                            cursor: "default",
                            opacity: hovered && hovered.id !== box.id ? 0.3 : 1,
                            transition: "opacity 150ms ease",
                          }}
                        >
                          <span style={{ fontSize: size.meta, letterSpacing: tracking.label, color: "#A8A8A8", width: 28, flexShrink: 0 }}>
                            ({String(i + 1).padStart(2, "0")})
                          </span>
                          <span style={{ flex: 1, fontSize: size.meta, letterSpacing: tracking.label, textTransform: "uppercase" }}>
                            {box.title}
                          </span>
                          <span style={{ fontSize: size.caption, letterSpacing: tracking.loose, textTransform: "uppercase", color: "#A8A8A8", flexShrink: 0 }}>
                            {formatNeighbourhood(box.neighbourhood)}
                          </span>
                          {i < route.length - 1 && (
                            <span style={{ fontSize: size.caption, color: "#C8C8C8", flexShrink: 0, width: 40, textAlign: "right" }}>
                              {Math.round(dist(route[i], route[i + 1]))}m
                            </span>
                          )}
                        </div>
                        {i < route.length - 1 && <div style={{ height: 1, background: "#F0F0F0" }} />}
                      </div>
                    ))}
                  </div>

                  {/* Open in Maps */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 32,
                      fontSize: size.caption,
                      letterSpacing: tracking.loose,
                      textTransform: "uppercase",
                      fontFamily: "inherit",
                      color: "#202020",
                      textDecoration: "none",
                      borderBottom: "1px solid #202020",
                      paddingBottom: 2,
                    }}
                  >
                    Open in Google Maps ↗
                  </a>
                </>
              )
            )}
          </div>

          {/* Hover preview — pinned to row, right side */}
          <AnimatePresence>
            {hovered && hovered.images?.[0] && (
              <motion.div
                key={hovered.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: "absolute",
                  left: 600,
                  top: Math.min(
                    rowTop,
                    (containerRef.current?.scrollTop ?? 0) +
                    (containerRef.current?.clientHeight ?? 0) - PREVIEW_H - 24
                  ),
                  width: PREVIEW_W,
                  height: PREVIEW_H,
                  overflow: "hidden",
                  pointerEvents: "none",
                  boxShadow: "0 10px 32px rgba(0,0,0,0.12)",
                  zIndex: 10,
                }}
              >
                <Image
                  src={hovered.images[0]}
                  alt={hovered.title}
                  fill
                  style={{ objectFit: "cover" }}
                  unoptimized
                  placeholder="blur"
                  blurDataURL={BLUR}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
