"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { size, tracking } from "@/lib/typography";

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        translate: "-50% 0",
        zIndex: 100,
        backgroundColor: "#202020",
        color: "#FFFFFF",
        fontSize: size.caption,
        letterSpacing: tracking.loose,
        textTransform: "uppercase",
        padding: "9px 16px",
        fontFamily: '"Geist", system-ui, sans-serif',
        pointerEvents: "none",
      }}
    >
      {message}
    </motion.div>
  );
}
