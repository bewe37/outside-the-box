"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { size, tracking, leading } from "@/lib/typography";
import { useNav } from "@/app/components/nav-context";
import { useAuth } from "@/app/components/auth-context";
import { supabase } from "@/lib/supabase";

export function SiteNav() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const { right } = useNav();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) { setCount(0); return; }
    supabase
      .from("collections")
      .select("box_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [user]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 44,
        boxSizing: "border-box",
        paddingInline: 8,
        position: "relative",
        flexShrink: 0,
        background: "#FFFFFF",
        borderBottom: "1px solid transparent",
      }}
    >
      {/* Wordmark */}
      <Link href="/gallery" style={wordmark}>
        OutsideTheBox
      </Link>

      {/* Center links */}
      <div
        style={{
          display: "flex",
          gap: 20,
          position: "absolute",
          left: "50%",
          top: "50%",
          translate: "-50% -50%",
        }}
      >
        <NavLink href="/gallery" active={pathname === "/gallery"}>
          GALLERY
        </NavLink>
        <NavLink href="/about" active={pathname === "/about"}>
          ABOUT
        </NavLink>
        <NavLink href="/collection" active={pathname === "/collection"}>
          MY COLLECTION ({count})
        </NavLink>
      </div>

      {/* Right slot — injected by the active page */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {right}
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
  color: "#202020",
  textDecoration: "none",
  lineHeight: "14px",
  whiteSpace: "pre",
};
