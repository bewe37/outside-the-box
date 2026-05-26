"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { boxes, type Box } from "@/lib/data";
import { SiteNav } from "@/app/components/site-nav";

export default function CollectionPage() {
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [allBoxes, setAllBoxes] = useState<Box[]>(boxes);

  useEffect(() => {
    fetch("/api/boxes")
      .then((r) => r.json())
      .then((extra: Box[]) => {
        if (extra.length > 0) setAllBoxes([...boxes, ...extra]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("otb_collected");
      if (stored) setCollected(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const collectedBoxes = allBoxes.filter((b) => collected.has(b.id));

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: '"Geist", system-ui, sans-serif',
        backgroundColor: "#FFFFFF",
        color: "#202020",
      }}
    >
      <SiteNav collectedCount={collected.size} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {collectedBoxes.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 36,
                letterSpacing: "-0.06em",
                fontWeight: 500,
                color: "#E8E8E8",
              }}
            >
              0
            </div>
            <p
              style={{
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#AAAAAA",
                margin: 0,
              }}
            >
              Your collection is empty
            </p>
            <Link
              href="/gallery"
              style={{
                marginTop: 8,
                fontSize: 10,
                letterSpacing: "-0.02em",
                fontWeight: 500,
                textTransform: "uppercase",
                color: "#202020",
                textDecoration: "none",
                borderBottom: "1px solid #E8E8E8",
                paddingBottom: 2,
              }}
            >
              Browse the gallery →
            </Link>
          </div>
        ) : (
          <div style={{ padding: "36px 20px" }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 40,
                borderBottom: "1px solid #E8E8E8",
                paddingBottom: 20,
              }}
            >
              <span
                style={{
                  fontSize: 30,
                  letterSpacing: "-0.06em",
                  fontWeight: 500,
                  lineHeight: 1,
                }}
              >
                {collectedBoxes.length}
              </span>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  color: "#AAAAAA",
                }}
              >
                {collectedBoxes.length === 1 ? "Box collected" : "Boxes collected"}
              </span>
            </div>

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 24,
              }}
            >
              {collectedBoxes.map((box) => (
                <div key={box.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "1",
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      src={(box.images && box.images[0]) ?? `https://picsum.photos/seed/box${box.id}/320/320`}
                      unoptimized={!!(box.images && box.images[0])}
                      alt={box.title}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "-0.03em",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        color: "#202020",
                        marginBottom: 2,
                      }}
                    >
                      {box.title}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: "-0.01em",
                        color: "#AAAAAA",
                        textTransform: "uppercase",
                      }}
                    >
                      {box.neighbourhood}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
