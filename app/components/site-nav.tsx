"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { size, tracking, leading } from "@/lib/typography";
import { useNav } from "@/app/components/nav-context";
import { useAuth } from "@/app/components/auth-context";
import { useTheme } from "@/app/components/theme-context";
import { supabase } from "@/lib/supabase";

function NavPageLink({ href, label, active, adaptive }: { href: string; label: string; active: boolean; adaptive: boolean }) {
  const [hovered, setHovered] = useState(false);
  // In difference blend mode, white inverts to readable dark on light areas
  // and stays white on dark areas. Inactive links use a mid grey that reads
  // as muted in both modes.
  const activeColor = adaptive ? "#FFFFFF" : "#202020";
  // On the dark gallery pages the nav sits over the scene with no bar. Links
  // rest at a slightly dimmed white and brighten to full white on hover/active.
  const mutedColor = adaptive ? "rgba(255,255,255,0.65)" : "#A8A8A8";
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: size.meta,
        lineHeight: leading.meta,
        letterSpacing: tracking.label,
        textTransform: "uppercase",
        color: active || hovered ? activeColor : mutedColor,
        textDecoration: "none",
        transition: "color 0.15s ease",
        fontWeight: 500,
      }}
    >
      [{label}]
    </Link>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const { right } = useNav();
  const { user } = useAuth();
  // Routes go dark only when the page asserts its dark view is showing (e.g.
  // /collection once the gallery is up, but not on the light sign-in / empty
  // states; /cylinder-test always).
  const { dark: isDark } = useTheme();

  useEffect(() => {
    if (!user) { setCount(0); return; }
    supabase
      .from("collections")
      .select("box_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [user]);

  const links = [
    { href: "/gallery", label: "BOXES" },
    { href: "/about", label: "ABOUT" },
    { href: "/collection", label: "COLLECTION" },
  ];

  return (
    <div
      className="site-nav"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 44,
        boxSizing: "border-box",
        paddingInline: 20,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: isDark ? "transparent" : "#FFFFFF",
        borderBottom: "1px solid transparent",
        transition: "background-color 0.2s ease",
      }}
    >
      {/* Wordmark */}
      <Link href="/gallery" style={{ ...wordmark, color: isDark ? "#FFFFFF" : "#202020" }}>
        OutsideTheBox
      </Link>

      {/* Center slot — grid/filter/index controls */}
      <div className="nav-right-slot" style={{ color: isDark ? "#FFFFFF" : "#202020" }}>
        <AnimatePresence mode="wait">
          {right && (
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {right}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav links — right */}
      <div className="nav-page-links">
        {links.map(({ href, label }) => (
          <NavPageLink key={href} href={href} label={label} active={pathname === href} adaptive={isDark} />
        ))}
      </div>
    </div>
  );
}

export function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        fontSize: size.meta,
        lineHeight: leading.meta,
        letterSpacing: tracking.label,
        textTransform: "uppercase",
        color: active ? "#202020" : "#A8A8A8",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

const wordmark: React.CSSProperties = {
  fontSize: size.meta,
  letterSpacing: tracking.label,
  fontWeight: 500,
  textTransform: "uppercase",
  textDecoration: "none",
  lineHeight: "14px",
  whiteSpace: "pre",
};
