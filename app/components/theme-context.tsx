"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// Whether the CURRENT page is rendering its dark (cylinder-gallery) view.
// Pages opt in by calling useSetDarkTheme(true) while their dark view is
// mounted — e.g. /collection only when signed in with collected boxes, so
// the sign-in / empty states stay light. The nav and the route transition
// read this so they only flip dark when a dark view is actually on screen.
type ThemeCtx = { dark: boolean; setDark: (v: boolean) => void };

const ThemeContext = createContext<ThemeCtx>({ dark: false, setDark: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const pathname = usePathname();

  // Reset to light whenever the route changes; the destination page re-asserts
  // dark if it needs to. Prevents a stale dark flag leaking across navigations.
  useEffect(() => { setDark(false); }, [pathname]);

  return (
    <ThemeContext.Provider value={{ dark, setDark }}>
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
