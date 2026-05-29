"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import LoadingAnimation from "./LoadingAnimation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);

  return (
    <>
      <AnimatePresence>
        {!done && <LoadingAnimation key="loader" onDone={() => setDone(true)} />}
      </AnimatePresence>
      {children}
    </>
  );
}
