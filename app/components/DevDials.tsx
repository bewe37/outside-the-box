"use client";

import { DialRoot } from "dialkit";
import "dialkit/styles.css";

// Renders the DialKit control panel root. Dev-only — the panels themselves
// (e.g. the index depth-stack dials) register into this root via useDialKit.
export function DevDials() {
  if (process.env.NODE_ENV !== "development") return null;
  return <DialRoot position="bottom-left" />;
}
