import React from "react";
import { size, tracking, weight, leading } from "@/lib/typography";

export default function AboutPage() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: '"Geist", system-ui, sans-serif',
        color: "#202020",
        backgroundColor: "#FFFFFF",
      }}
    >
      {/* Full-height canvas below nav */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Sections — centered in the middle of the page */}
        <div
          style={{
            position: "absolute",
            top: "46%",
            left: "42%",
            translate: "-50% -50%",
          }}
        >
          <Section indent={0} label="About">
            Toronto is covered in painted utility boxes — electrical cabinets, traffic
            control pedestals, telecom enclosures — wrapped in murals by local artists.
            Most people walk past them every day without stopping. This is my attempt
            to document them: where they are, who made them, and when. Not exhaustive,
            not official. Just one person paying attention.
          </Section>

          <Section indent={1} label="How I collect">
            Every box here is one I&apos;ve found and photographed myself, on foot. I
            shoot with my phone, record the address and neighbourhood, and track down
            the artist credit where I can — from signage on the box, city program
            listings, or the artist&apos;s own social media. Some boxes have no
            credit at all; I note that too rather than guess.
          </Section>

          <Section indent={2} label="Finding them">
            The easiest rule: look for red lights. Nearly every signalised intersection
            in Toronto has a utility box on the corner, and many of them are painted.
            If you&apos;re walking through Leslieville, Parkdale, Kensington, or
            Trinity Bellwoods — slow down at the corners and you&apos;ll start seeing
            them everywhere.
          </Section>

          <Section indent={3} label="Seen one I missed?">
            If you&apos;ve spotted a box that isn&apos;t in the archive — or you have
            a better photo, a correction to an artist credit, or just want to say
            hello — I&apos;d genuinely love to hear about it. Send me the address and
            a photo.
            <br /><br />
            <a
              href="mailto:bryanwinata112@gmail.com"
              style={{
                color: "#202020",
                letterSpacing: tracking.normal,
                textDecoration: "none",
                borderBottom: "1px solid #202020",
                paddingBottom: 1,
              }}
            >
              bryanwinata112@gmail.com
            </a>
          </Section>
        </div>

        {/* Title — bottom-left, like SoManyCones */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            fontSize: "clamp(28px, 4vw, 48px)",
            lineHeight: 0.92,
            letterSpacing: tracking.tight,
            fontWeight: weight.medium,
            textTransform: "uppercase",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          OutsideTheBox
        </div>

      </div>
    </div>
  );
}

const INDENT_STEP = 140;

function Section({
  indent,
  label,
  children,
}: {
  indent: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginLeft: indent * INDENT_STEP,
        marginTop: indent === 0 ? 0 : 52,
        maxWidth: 560,
      }}
    >
      <div
        style={{
          fontSize: size.caption,
          lineHeight: leading.caption,
          letterSpacing: tracking.loose,
          textTransform: "uppercase",
          color: "#202020",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: size.body,
          lineHeight: leading.body,
          letterSpacing: tracking.normal,
          color: "#202020",
        }}
      >
        {children}
      </div>
    </div>
  );
}
