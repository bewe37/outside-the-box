"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { boxes as staticBoxes, type Box } from "@/lib/data";
import { useSetDarkTheme } from "@/app/components/theme-context";

const CylinderGallery3D = dynamic(() => import("./CylinderGallery3D"), { ssr: false });

const hasUpload = (b: Box) => !!(b.images && b.images.length > 0);

export default function CylinderTestPage() {
  const [boxes, setBoxes] = useState<Box[]>(() => staticBoxes.filter(hasUpload));
  useSetDarkTheme(true);

  useEffect(() => {
    fetch("/api/boxes")
      .then((r) => r.json())
      .then((extra: Box[]) => {
        setBoxes([...staticBoxes, ...extra].filter(hasUpload));
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <CylinderGallery3D boxes={boxes} />
    </div>
  );
}
