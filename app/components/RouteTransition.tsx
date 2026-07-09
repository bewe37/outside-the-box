"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useTheme } from "@/app/components/theme-context";

// A cool light↔dark transition. It fires whenever the *rendered* theme flips
// (tracked in ThemeContext, which a page asserts only when its dark view is
// actually on screen — e.g. /collection only once signed in with boxes). The
// new view has already mounted, so this is a reveal: a full-screen solid in
// the new theme's colour covers everything, then an iris circle closes to a
// point, wiping the overlay away to expose the page — reading as the world
// flooding to black (into the dark gallery) or to white (back out).
export function RouteTransition() {
  const { dark } = useTheme();
  const prevDark = useRef(dark);
  const [wipe, setWipe] = useState<null | { color: string; id: number }>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (dark !== prevDark.current) {
      setWipe({ color: dark ? "#000000" : "#FFFFFF", id: ++idRef.current });
    }
    prevDark.current = dark;
  }, [dark]);

  if (!wipe) return null;

  return (
    <motion.div
      key={wipe.id}
      // Start fully covering (iris wide open), then close the iris to a point,
      // wiping the overlay off to reveal the page underneath.
      initial={{ clipPath: "circle(150% at 50% 50%)" }}
      animate={{ clipPath: "circle(0% at 50% 50%)" }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.1 }}
      onAnimationComplete={() => setWipe(null)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        background: wipe.color,
      }}
    />
  );
}
