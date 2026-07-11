"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimate } from "motion/react";

const W = 890;
const H = 1280;

const STROKE_W = 360;
const ANGLE_OFFSET = 200;
const N_STROKES = 5;
const STAGGER_MS = 55;
const STROKE_DURATION_MS = 650; // each stroke draw duration
// ease: fast-in, slow-out (like a real brush)
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function buildStrokes() {
  return Array.from({ length: N_STROKES }, (_, i) => {
    const t = i / (N_STROKES - 1);
    const cy = t * H;
    const x1 = -STROKE_W / 2 - ANGLE_OFFSET;
    const y1 = cy + ANGLE_OFFSET * 0.55;
    const x2 = W + STROKE_W / 2 + ANGLE_OFFSET;
    const y2 = cy - ANGLE_OFFSET * 0.55;
    const len = Math.hypot(x2 - x1, y2 - y1);
    return { x1, y1, x2, y2, len };
  });
}

const STROKES = buildStrokes();

export default function LoadingAnimation({ onDone }: { onDone?: () => void }) {
  const [scope, animate] = useAnimate();
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const markRef = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Set initial dashoffset (hidden) on all lines
    lineRefs.current.forEach((el, i) => {
      if (el) {
        el.style.strokeDasharray = String(STROKES[i].len);
        el.style.strokeDashoffset = String(STROKES[i].len);
      }
    });

    let cancelled = false;

    function animateStroke(index: number) {
      const el = lineRefs.current[index];
      if (!el || cancelled) return;
      const len = STROKES[index].len;
      const start = performance.now();

      function tick(now: number) {
        if (cancelled) return;
        const raw = Math.min((now - start) / STROKE_DURATION_MS, 1);
        const progress = easeOut(raw);
        if (el) el.style.strokeDashoffset = String(len * (1 - progress));
        if (raw < 1) {
          requestAnimationFrame(tick);
        } else {
          if (el) el.style.strokeDashoffset = "0";
          // Start next stroke
          if (index + 1 < N_STROKES) {
            setTimeout(() => animateStroke(index + 1), STAGGER_MS);
          } else {
            // All done — the white panel lifts up off-screen (a curtain
            // rising) while the mark shrinks and fades slightly as it goes,
            // instead of a flat cross-fade to the page underneath.
            setTimeout(async () => {
              if (!cancelled) {
                await Promise.all([
                  animate(scope.current, { y: "-100%" }, { duration: 0.7, ease: [0.76, 0, 0.24, 1] }),
                  animate(markRef.current, { scale: 0.85, opacity: 0 }, { duration: 0.5, ease: "easeIn" }),
                ]);
                onDone?.();
              }
            }, 180);
          }
        }
      }

      requestAnimationFrame(tick);
    }

    // Small delay so images are painted
    setTimeout(() => animateStroke(0), 100);

    return () => { cancelled = true; };
  }, [animate, scope, onDone]);

  const maskId = "brush-mask-unique";

  return (
    <motion.div
      ref={scope}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#FFFFFF",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        padding: 32,
        pointerEvents: "none",
      }}
    >
      <div ref={markRef} style={{ position: "relative", width: 70, height: 100 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/BeforeLoading.svg"
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />

        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden" }}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width={W} height={H} fill="black" />
              {STROKES.map(({ x1, y1, x2, y2, len }, i) => (
                <line
                  key={i}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke="white"
                  strokeWidth={STROKE_W}
                  strokeLinecap="butt"
                  style={{ strokeDasharray: len, strokeDashoffset: len }}
                />
              ))}
            </mask>
          </defs>

          <image
            href="/AfterLoading.svg"
            x="0" y="0"
            width={W} height={H}
            mask={`url(#${maskId})`}
          />
        </svg>
      </div>
    </motion.div>
  );
}
