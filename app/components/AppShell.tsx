"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import LoadingAnimation from "./LoadingAnimation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);

  return (
    // reducedMotion="user": every Motion animation in the tree respects the
    // OS-level prefers-reduced-motion setting (transforms disabled, opacity
    // kept) without per-component wiring.
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {!done && <LoadingAnimation key="loader" onDone={() => setDone(true)} />}
      </AnimatePresence>
      {children}
    </MotionConfig>
  );
}
