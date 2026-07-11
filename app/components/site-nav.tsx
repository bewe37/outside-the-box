"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNav } from "@/app/components/nav-context";
import { useTheme } from "@/app/components/theme-context";

// Simple text nav — no chips, no fills, no boxes. Just labels; the active
// section is simply full-strength text while the rest sit muted.

// Nav spacing (px). Gallery/Index sit close together as a related pair, then
// a wider gap before Information.
const WORDMARK_TO_NAV = 180;  // gap between the wordmark and the section tabs
const GALLERY_INDEX_GAP = 10; // gap between "Gallery" and "Index" (the close pair)
const PAIR_TO_INFO_GAP = 200; // gap between that pair and "Information"

// The centre tabs. Gallery = the drum, Index = the list view (a query flag on
// /gallery), Information = /about. `viewFlag` deep-links Index to the list.
const sections = [
  { label: "Gallery", href: "/gallery", viewFlag: null as string | null },
  { label: "Index", href: "/gallery?view=list", viewFlag: "list" },
  { label: "Information", href: "/about", viewFlag: null as string | null },
];

// A plain text link. `active` is just full-strength text colour; everything
// else sits at reduced opacity so the current section reads clearly without
// any box/fill/underline.
function NavText({
  children,
  active,
  dark,
  as = "span",
  href,
  external,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  dark?: boolean;
  as?: "span" | "a" | "link";
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: 400,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    textDecoration: "none",
    boxSizing: "border-box",
    color: dark ? "#FFFFFF" : "#101010",
    opacity: active === false ? 0.45 : 1,
    cursor: href || onClick ? "pointer" : "default",
    // 0.15s ease — the sitewide micro-interaction standard.
    transition: "opacity 0.15s ease",
  };

  if (as === "link" && href) {
    return (
      <Link href={href} onClick={onClick} style={style} className="nav-text">
        {children}
      </Link>
    );
  }
  if (as === "a" && href) {
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        onClick={onClick}
        style={style}
        className="nav-text"
      >
        {children}
      </a>
    );
  }
  return <span style={style}>{children}</span>;
}

export function SiteNav() {
  const pathname = usePathname();
  const { hidden } = useNav();
  // Publishes the "Information" tab's x-position so pages (like /about) can
  // align their content to it — the nav's spacing is DialKit-tunable, so this
  // stays in sync instead of a hardcoded pixel guess.
  const infoRef = useRef<HTMLSpanElement>(null);
  // The cylinder drum's pages are black — plain #101010 text would vanish,
  // so text flips to white there.
  const { dark: isDark } = useTheme();

  // Track ?view=list so the "Index" tab shows active. Read on mount + whenever
  // the query changes (the gallery dispatches "gallery-view" when toggled).
  const [listView, setListView] = useState(false);
  useEffect(() => {
    const sync = () => setListView(new URLSearchParams(window.location.search).get("view") === "list");
    sync();
    const onView = (e: Event) => setListView((e as CustomEvent<string>).detail === "list");
    window.addEventListener("gallery-view", onView as EventListener);
    return () => window.removeEventListener("gallery-view", onView as EventListener);
  }, [pathname]);

  const sectionActive = (s: (typeof sections)[number]) => {
    if (s.viewFlag === "list") return pathname === "/gallery" && listView;
    if (s.href === "/gallery") return pathname === "/gallery" && !listView;
    return pathname === s.href;
  };

  // Broadcast "Information"'s x-position so /about can align its content to
  // it — re-measured on resize.
  useEffect(() => {
    const publish = () => {
      if (!infoRef.current) return;
      const left = infoRef.current.getBoundingClientRect().left;
      window.dispatchEvent(new CustomEvent("nav-info-x", { detail: left }));
    };
    publish();
    window.addEventListener("resize", publish);
    return () => window.removeEventListener("resize", publish);
  }, []);

  return (
    <nav
      className="site-nav simple-nav"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        // Wordmark + section tabs cluster together on the left; "Contact"
        // is pushed to the far right via margin-left: auto below. Gaps render
        // at their exact value on normal screens, shrinking only on narrow
        // viewports (the vw ceiling) so large values can't push the row
        // wider than the screen (which clipped "Contact" before).
        columnGap: `min(${WORDMARK_TO_NAV}px, 18vw)`,
        padding: "14px 24px",
        fontFamily: '"Geist", system-ui, sans-serif',
        // Fades out while a detail panel owns the screen (see useHideNav).
        opacity: hidden ? 0 : 1,
        visibility: hidden ? "hidden" : "visible",
        transition: "opacity 0.2s ease, visibility 0.2s",
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      {/* Left: wordmark */}
      <Link
        href="/gallery"
        className="nav-wordmark"
        style={{
          fontSize: 14,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          color: isDark ? "#FFFFFF" : "#101010",
          textDecoration: "none",
        }}
      >
        OutsideTheBox
      </Link>

      {/* Section tabs, right next to the wordmark. Gallery/Index sit close
          together (a related pair, like the reference's "Film, Photography"),
          then a wider gap before Information. */}
      <div className="nav-tabs" style={{ display: "flex", alignItems: "center", gap: `min(${PAIR_TO_INFO_GAP}px, 14vw)` }}>
        <div id="nav-gallery-tab" className="nav-pair" style={{ display: "flex", alignItems: "center", gap: GALLERY_INDEX_GAP }}>
          {sections.slice(0, 2).map((s) => (
            <span
              key={s.label}
              // The Index (list) view is desktop-only — hidden on phones.
              className={s.viewFlag === "list" ? "nav-index-tab" : undefined}
              // Fire the gallery-view event so the drum/list toggles without
              // a full remount when we're already on /gallery.
              onClick={() => {
                if (s.href.startsWith("/gallery")) {
                  window.dispatchEvent(new CustomEvent("gallery-view", { detail: s.viewFlag ?? "" }));
                }
              }}
            >
              <NavText as="link" href={s.href} active={sectionActive(s)} dark={isDark}>
                {s.label}
              </NavText>
            </span>
          ))}
        </div>
        <span ref={infoRef} id="nav-info-tab">
          <NavText as="link" href={sections[2].href} active={sectionActive(sections[2])} dark={isDark}>
            {sections[2].label}
          </NavText>
        </span>
      </div>

      {/* Right: contact, pinned to the far edge — muted like the other
          non-active tabs; it's an action link, not a "current section". */}
      <span className="nav-contact" style={{ marginLeft: "auto" }}>
        <NavText as="a" href="mailto:bryanwinata112@gmail.com" active={false} dark={isDark}>
          Contact
        </NavText>
      </span>
    </nav>
  );
}
