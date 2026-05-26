"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function SiteNav({
  collectedCount,
  right,
  borderBottom = true,
}: {
  collectedCount?: number;
  right?: ReactNode;
  borderBottom?: boolean;
}) {
  const pathname = usePathname();
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    if (collectedCount !== undefined) return;
    try {
      const s = localStorage.getItem("otb_collected");
      setLocalCount(s ? JSON.parse(s).length : 0);
    } catch {}
  }, [collectedCount]);

  const count = collectedCount ?? localCount;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBlock: 14,
        paddingInline: 16,
        position: "relative",
        flexShrink: 0,
        background: "#FFFFFF",
        borderBottom: borderBottom ? "1px solid #E8E8E8" : "none",
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

      {/* Right slot */}
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
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 11,
        letterSpacing: "-0.04em",
        fontWeight: 500,
        textTransform: "uppercase",
        color: active ? "#202020" : "#A8A8A8",
        textDecoration: "none",
        lineHeight: "14px",
      }}
    >
      {children}
    </Link>
  );
}

const wordmark: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "-0.04em",
  fontWeight: 500,
  textTransform: "uppercase",
  color: "#202020",
  textDecoration: "none",
  lineHeight: "14px",
  whiteSpace: "pre",
};
