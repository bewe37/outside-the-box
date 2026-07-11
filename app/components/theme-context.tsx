"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Whether the CURRENT page is rendering its dark (cylinder-gallery) view.
// Pages opt in by calling useSetDarkTheme(true) while their dark view is
// mounted — e.g. /collection only when signed in with collected boxes, so
// the sign-in / empty states stay light. The nav and the route transition
// read this so they only flip dark when a dark view is actually on screen.
type ThemeCtx = { dark: boolean; setDark: (v: boolean) => void };

const ThemeContext = createContext<ThemeCtx>({ dark: false, setDark: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  // What consumers actually see. Navigating between two dark pages can flip
  // the raw value true→false→true (the old page's unmount cleanup, then the
  // new page re-asserting) — if consumers saw that transient, the nav text,
  // body background and route wipe would all flash light for a beat. The raw
  // value has to hold for 80ms before it's exposed, so flip-flops never
  // reach the UI.
  const [settledDark, setSettledDark] = useState(false);

  // NOTE: there is deliberately NO reset-on-pathname effect here. Parent
  // effects run AFTER child effects, so a route-change reset fires after the
  // destination page's useSetDarkTheme(true) and clobbers it back to light —
  // that painted the nav white/dark-on-dark on every navigation. The reset
  // is already handled correctly by useSetDarkTheme's own cleanup: the old
  // page unmounting sets false, the new page mounting sets its own value,
  // both batched within the same commit.

  useEffect(() => {
    if (dark === settledDark) return;
    const id = setTimeout(() => setSettledDark(dark), 80);
    return () => clearTimeout(id);
  }, [dark, settledDark]);

  // Body's own background shows through the strip behind the floating nav
  // (which is transparent) on pages shorter than the viewport — keep it in
  // sync with the active page's theme so that strip isn't always white.
  useEffect(() => {
    document.body.style.background = settledDark ? "#000000" : "";
  }, [settledDark]);

  return (
    <ThemeContext.Provider value={{ dark: settledDark, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Convenience for a page to declare "my dark view is showing" for its lifetime.
export function useSetDarkTheme(active: boolean) {
  const { setDark } = useTheme();
  useEffect(() => {
    setDark(active);
    return () => setDark(false);
  }, [active, setDark]);
}
