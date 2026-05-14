"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { boxes } from "@/lib/data";

export default function CollectionPage() {
  const [collected, setCollected] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("otb_collected");
      if (stored) setCollected(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const collectedBoxes = boxes.filter((b) => collected.has(b.id));

  return (
    <div className="flex flex-col h-full uppercase tracking-widest text-[11px] font-medium" style={{ color: "var(--ink)" }}>
      {/* NAV */}
      <nav
        className="flex items-center justify-between px-6 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex gap-6">
          <Link href="/gallery" className="opacity-40 hover:opacity-100 transition-opacity">
            GALLERY
          </Link>
          <Link href="/about" className="opacity-40 hover:opacity-100 transition-opacity">
            ABOUT
          </Link>
          <Link href="/collection" className="opacity-100 hover:opacity-60 transition-opacity">
            MY COLLECTION ({collected.size})
          </Link>
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-semibold tracking-widest">
          OUTSIDETHEBOX
        </span>
        <div />
      </nav>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">
        {collectedBoxes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "var(--muted)" }}>
            <span className="text-2xl font-bold">0</span>
            <p>YOUR COLLECTION IS EMPTY</p>
            <Link
              href="/gallery"
              className="px-4 py-2 border transition-colors hover:border-transparent"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              GO EXPLORE →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-3xl font-bold">{collectedBoxes.length}</span>
              <span style={{ color: "var(--muted)" }}>
                {collectedBoxes.length === 1 ? "BOX COLLECTED" : "BOXES COLLECTED"}
              </span>
            </div>

            {/* Sticker grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {collectedBoxes.map((box) => (
                <div key={box.id} className="flex flex-col gap-2 items-center">
                  {/* Sticker — for now just the image with a die-cut shadow effect */}
                  <div
                    className="relative overflow-hidden"
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: "50% 45% 55% 48% / 48% 52% 50% 52%",
                      boxShadow: "2px 3px 0 2px var(--border)",
                    }}
                  >
                    <Image
                      src={`https://picsum.photos/seed/box${box.id}/240/240`}
                      alt={box.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-semibold tracking-widest">{box.title}</span>
                  <span className="text-[9px]" style={{ color: "var(--muted)" }}>
                    {box.neighbourhood}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
