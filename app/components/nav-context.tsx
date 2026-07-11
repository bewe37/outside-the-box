"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteNav } from "@/app/components/site-nav";

type NavCtx = {
  right: ReactNode;
  setRight: (node: ReactNode) => void;
  // Set while a full-attention overlay (e.g. a detail panel) is on screen, so
  // the floating nav pieces get out of its way.
  hidden: boolean;
  setHidden: (v: boolean) => void;
};

const NavContext = createContext<NavCtx>({ right: null, setRight: () => {}, hidden: false, setHidden: () => {} });

export function NavProvider({ children }: { children: ReactNode }) {
  const [right, setRight] = useState<ReactNode>(null);
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();
  const showNav = !pathname.startsWith("/admin");

  return (
    <NavContext.Provider value={{ right, setRight, hidden, setHidden }}>
      {showNav && <SiteNav />}
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  return useContext(NavContext);
}

// Convenience for an overlay to declare "hide the nav while I'm mounted".
export function useHideNav(active: boolean) {
  const { setHidden } = useNav();
  useEffect(() => {
    setHidden(active);
    return () => setHidden(false);
  }, [active, setHidden]);
}
