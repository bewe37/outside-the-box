"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteNav } from "@/app/components/site-nav";

type NavCtx = {
  right: ReactNode;
  setRight: (node: ReactNode) => void;
};

const NavContext = createContext<NavCtx>({ right: null, setRight: () => {} });

export function NavProvider({ children }: { children: ReactNode }) {
  const [right, setRight] = useState<ReactNode>(null);
  const pathname = usePathname();
  const showNav = !pathname.startsWith("/admin");

  return (
    <NavContext.Provider value={{ right, setRight }}>
      {showNav && <SiteNav />}
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  return useContext(NavContext);
}
