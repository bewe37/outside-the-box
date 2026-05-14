import Link from "next/link";

export default function AboutPage() {
  return (
    <div
      style={{
        height: "100%",
        fontFamily: '"Geist", system-ui, sans-serif',
        color: "#202020",
        backgroundColor: "#111111",
        position: "relative",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBlock: 18,
          paddingInline: 16,
          position: "relative",
          borderBottom: "1px solid #A8A8A8",
        }}
      >
        <span
          style={{
            fontSize: 14,
            letterSpacing: "-0.06em",
            fontWeight: 500,
            textTransform: "uppercase",
            whiteSpace: "pre",
            color: "#202020",
            lineHeight: "18px",
          }}
        >
          OutsideTheBox
        </span>
        <div
          style={{
            display: "flex",
            gap: 20,
            position: "absolute",
            left: "50%",
            top: 18,
            translate: "-50%",
          }}
        >
          <NavLink href="/gallery">GALLERY</NavLink>
          <NavLink href="/about" active>ABOUT</NavLink>
          <NavLink href="/collection">MY COLLECTION</NavLink>
        </div>
        <div />
      </nav>

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "start",
          gap: 24,
          position: "absolute",
          left: 20,
          top: 80,
        }}
      >
        {/* Heading */}
        <span
          style={{
            fontSize: 40,
            letterSpacing: "-0.05em",
            lineHeight: "52px",
            fontWeight: 500,
            textTransform: "uppercase",
            fontFamily: '"Geist", system-ui, sans-serif',
            color: "#202020",
            display: "block",
            whiteSpace: "pre-wrap",
          }}
        >
          {"A Field Guide to Toronto's\nPainted Utility Boxes."}
        </span>

        {/* Body paragraphs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p
            style={{
              width: 590,
              fontSize: 16,
              letterSpacing: "-0.04em",
              lineHeight: "26px",
              fontWeight: 400,
              fontFamily: '"Geist", system-ui, sans-serif',
              color: "#202020",
              margin: 0,
            }}
          >
            OutsideTheBox is a personal archive of murals commissioned onto electrical and utility
            boxes across Toronto&apos;s neighbourhoods. Each entry is photographed, tagged by location,
            and indexed — building a street-level map of the city&apos;s smallest galleries.
          </p>

          <p
            style={{
              width: 590,
              fontSize: 16,
              letterSpacing: "-0.04em",
              lineHeight: "26px",
              fontWeight: 400,
              fontFamily: '"Geist", system-ui, sans-serif',
              color: "#202020",
              margin: 0,
            }}
          >
            The project started as a way to notice what most people walk past. These boxes —
            painted by commissioned artists, local crews, and occasional strangers — sit at eye level
            on nearly every block. Most go unnamed. This is an attempt to change that.
          </p>
        </div>

        {/* Footer line */}
        <p
          style={{
            fontSize: 15,
            letterSpacing: "-0.02em",
            lineHeight: "24px",
            fontWeight: 400,
            fontFamily: '"Geist", system-ui, sans-serif',
            color: "#888888",
            margin: 0,
            whiteSpace: "pre",
          }}
        >
          Know a box we haven&apos;t found yet? Have a better photo? Send it in.
        </p>
      </div>
    </div>
  );
}

function NavLink({
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
        fontSize: 14,
        letterSpacing: "-0.06em",
        fontWeight: 500,
        textTransform: "uppercase",
        color: active ? "#202020" : "#A8A8A8",
        textDecoration: "none",
        lineHeight: "18px",
      }}
    >
      {children}
    </Link>
  );
}
