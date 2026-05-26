import Link from "next/link";
import { SiteNav } from "@/app/components/site-nav";

export default function AboutPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: '"Geist", system-ui, sans-serif',
        color: "#202020",
        backgroundColor: "#FFFFFF",
      }}
    >
      <SiteNav />

      {/* Hero */}
      <div
        style={{
          borderBottom: "1px solid #E8E8E8",
          padding: "64px 20px 52px",
          maxWidth: 860,
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.1em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: "#AAAAAA",
            marginBottom: 16,
          }}
        >
          Toronto, Ontario — Personal Archive
        </div>
        <h1
          style={{
            fontSize: "clamp(22px, 3.5vw, 38px)",
            letterSpacing: "-0.05em",
            fontWeight: 500,
            lineHeight: 1.08,
            textTransform: "uppercase",
            margin: "0 0 20px",
            maxWidth: 700,
          }}
        >
          One person&apos;s record of Toronto&apos;s painted utility boxes.
        </h1>
        <p
          style={{
            fontSize: 13,
            letterSpacing: "-0.03em",
            lineHeight: "22px",
            color: "#555555",
            maxWidth: 560,
            margin: 0,
          }}
        >
          OutsideTheBox is a personal photo collection — boxes I&apos;ve walked past,
          stopped at, and photographed across Toronto. No official affiliation.
          Just someone paying attention.
        </p>
      </div>

      {/* Grid of info sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          borderBottom: "1px solid #E8E8E8",
        }}
      >
        <InfoBlock label="What this is">
          <p>
            Toronto is full of painted utility boxes — electrical cabinets, traffic
            control boxes, telecom pedestals — covered in murals by local artists.
            Most people walk past them every day without a second look.
          </p>
          <p>
            This site is my attempt to document them: where they are, who painted
            them, and when. Not exhaustive. Not official. Just mine.
          </p>
        </InfoBlock>

        <InfoBlock label="How I collect">
          <p>
            Every box here is one I&apos;ve personally photographed on foot. I record
            the address, neighbourhood, artist name where I can find it, and the year
            it was painted.
          </p>
          <p>
            Artist credits are pieced together from signage, city records, and social
            media. Some boxes have no credit at all — I note that too.
          </p>
        </InfoBlock>

        <InfoBlock label="The stamp mechanic">
          <p>
            Open a box in the gallery and you collect it — earning a neighbourhood
            stamp. Each stamp is drawn in the style of a vintage postal mark, unique
            to its area.
          </p>
          <p>
            There are 7 neighbourhoods in the archive so far: Leslieville, Parkdale,
            Kensington, Trinity Bellwoods, Riverside, Cork Town, and The Annex.
            Your collection lives in your browser.
          </p>
        </InfoBlock>

        <InfoBlock label="Seen one I missed?">
          <p>
            If you know a box I haven&apos;t found — or have a better photo, or a
            correction to an artist credit — I&apos;d genuinely love to hear about it.
          </p>
          <p>
            Send me the address and a photo and I&apos;ll take a look.
          </p>
          <p>
            <a
              href="mailto:bryanwinata112@gmail.com"
              style={{ color: "#202020", letterSpacing: "-0.02em" }}
            >
              bryanwinata112@gmail.com
            </a>
          </p>
        </InfoBlock>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #E8E8E8" }}>
        {[
          { value: "12", label: "Boxes Documented" },
          { value: "7", label: "Neighbourhoods" },
          { value: "On Foot", label: "How I get there" },
          { value: "Personal", label: "Not affiliated" },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: "28px 20px",
              borderRight: i < 3 ? "1px solid #E8E8E8" : "none",
            }}
          >
            <div
              style={{
                fontSize: 22,
                letterSpacing: "-0.06em",
                fontWeight: 500,
                color: "#202020",
                lineHeight: 1,
                marginBottom: 5,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                fontWeight: 500,
                textTransform: "uppercase",
                color: "#AAAAAA",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 10, color: "#CACACA", letterSpacing: "-0.02em" }}>
          OutsideTheBox — A personal Toronto archive
        </span>
        <Link
          href="/gallery"
          style={{
            fontSize: 10,
            letterSpacing: "-0.02em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: "#202020",
            textDecoration: "none",
          }}
        >
          Browse the Gallery →
        </Link>
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "36px 20px",
        borderRight: "1px solid #E8E8E8",
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.1em",
          fontWeight: 600,
          textTransform: "uppercase",
          color: "#AAAAAA",
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          letterSpacing: "-0.02em",
          lineHeight: "20px",
          color: "#444444",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
}
