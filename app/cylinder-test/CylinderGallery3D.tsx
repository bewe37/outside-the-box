"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { createPortal as createDomPortal } from "react-dom";
import { Canvas, useFrame, useThree, createPortal } from "@react-three/fiber";
import * as THREE from "three";
import Image from "next/image";
import { type Box, formatNeighbourhood, formatYear, formatAddress } from "@/lib/data";
import { tracking, leading } from "@/lib/typography";
import { useHideNav } from "@/app/components/nav-context";

// The whole gallery (canvas background, vignette fade, grid overlay, detail
// panel) is dark-themed — pure black, matching the void the drum floats in.
const BG_COLOR = "#000000";

// ─── Layout knobs ──────────────────────────────────────────────────────────
// The drum is organized into discrete horizontal ROWS, each with a FIXED
// number of cards (not "however many fit") — e.g. 6 per row, spaced 60°
// apart, so the whole row is visible at once from the centre. More photos
// means more rows stacked vertically, not more cards crammed per row.
const RADIUS = 4.6;                    // tighter radius so a 6-card row fills the view
const CARDS_PER_ROW = 6;
const ROW_SPACING = 3.4;               // vertical distance between row centres
const ROW_ANGLE_OFFSET = Math.PI / CARDS_PER_ROW; // alternate rows stagger by half a slot
const CARD_MAX = 2.65;                 // longest edge of a card, world units — slightly smaller for a bit more breathing room between cards
const CARD_MAX_LANDSCAPE = 3.3;        // landscape cards read small against portraits at the same longest-edge cap (a wide photo is shorter), so give them a bigger one
const JITTER_SEED_SCALE = 0.035;       // extra per-card rotation jitter, radians

const SCROLL_TO_RADIANS = 0.0016;      // scroll px -> rotation radians
const SCROLL_TO_Y = 0.0035;            // scroll px -> vertical drift, world units
const SMOOTHING_HALF_LIFE = 0.09;      // seconds for the lerp to close half the remaining gap — frame-rate independent

const CARD_CURVE_ANGLE = 0.62;         // radians of arc each card bends through — bigger = more warp
const CARD_SEGMENTS = 10;              // horizontal subdivisions for the bend — kept low, cost is per-card x144

const SATURATION_HALF_LIFE = 0.12;     // seconds for the b&w <-> colour crossfade to close half the remaining gap

const IDLE_DELAY = 1400;               // ms of no scroll input before auto-spin takes over
const IDLE_SPIN_SPEED = 0.045;         // radians/sec of the passive auto-rotation once idle
const IDLE_FADE_IN = 1.2;              // seconds for the auto-spin to ease up to full speed

const PARALLAX_ROT_STRENGTH = 0.12;    // radians of extra yaw at full mouse deflection
const PARALLAX_TILT_STRENGTH = 0.05;   // radians of extra pitch/roll at full mouse deflection
const PARALLAX_HALF_LIFE = 0.15;       // seconds for the parallax offset to settle toward the mouse target

const FISHEYE_STRENGTH = 0.06;         // how much the top/bottom bend inward — 0 = off

const CAMERA_FOV = 85;                 // vertical fov, degrees — shared by the Canvas and the px<->world math below

// Focused (clicked) card — a flat hero image parked in front of the camera,
// pushed left so the detail panel fits on the right half of the screen.
const FOCUS_X = -1.6;                  // horizontal offset of the hero image, world units (negative = left)
const FOCUS_Z = -3.2;                  // distance in front of the camera the hero sits, world units
const FOCUS_MAX_W = 4.5;               // max hero width, world units (fit keeps aspect within this box) — wide enough that landscape heroes aren't dwarfed by portrait ones
const FOCUS_MAX_H = 4.4;               // max hero height, world units
const FOCUS_HALF_LIFE = 0.14;          // seconds for the dimmer fade
const FOCUS_DURATION = 0.62;           // seconds for the hero fly-in (eased)
const FOCUS_CLOSE_DURATION = 0.8;      // seconds for the fly-out — a touch longer so the scale-down glides
const DIM_OPACITY = 0.97;              // how dark the drum gets behind the focused hero (0-1)

// Deterministic pseudo-random in [0, 1) from an integer seed — stable jitter
// per card without needing to store random state.
function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface PlacedImage {
  uid: string;      // unique per placed card (a box may be tiled several times)
  src: string;
  box: Box;         // full record, so a click can open the detail panel
  angle: number;    // position around the cylinder, radians
  yOffset: number;  // vertical placement, world units
  tilt: number;     // small individual extra rotation, radians
}

// A click captures the card's world transform in the (frozen) drum so the
// focused card can start from exactly where the card is and animate out along
// a continuous path. Two poses are captured:
//   • start — the card's LIVE transform at click, including whatever hover
//     "pop" (scale/offset) it happens to be at, so clicking mid-hover doesn't
//     jump the scale at the start of the transition.
//   • rest — the card's un-popped resting transform (where the drum card sits
//     when not hovered). The focused card animates BACK to this on close, so
//     it lands exactly where the returning drum card renders (no size/position
//     pop at the handoff).
// It also hands over the drum card's already-decoded texture so the hero can
// render on the very first frame (no gap while its hi-res copy loads).
interface Selection {
  item: PlacedImage;
  startPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  startScale: THREE.Vector3;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  restScale: THREE.Vector3;
  startTexture: THREE.Texture;
  startAspect: number;
  // True when this selection came from prev/next navigation while a focus
  // view was already open: the hero renders already parked (no fly-in) —
  // the user asked for a direct swap, not a re-run of the open animation.
  parked?: boolean;
}

// Programmatic card selection, used by the detail panel's prev/next: each
// (canonical) drum card registers a function that captures its poses and
// opens it, exactly like a click would.
type SelectRegistry = React.RefObject<Map<string, () => void>>;

// A plane bent into a shallow cylindrical arc — bows away from the viewer at
// the edges, matching the reference's curved-card look. Built once per size
// and cached, since width/height only take a handful of distinct values.
const curvedGeometryCache = new Map<string, THREE.BufferGeometry>();
function getCurvedGeometry(width: number, height: number) {
  const key = `${width.toFixed(3)}x${height.toFixed(3)}`;
  const cached = curvedGeometryCache.get(key);
  if (cached) return cached;

  const geo = new THREE.PlaneGeometry(width, height, CARD_SEGMENTS, 1);
  const pos = geo.attributes.position;
  // Bend radius derived from the card width and the chosen arc angle, so
  // wider cards curve at the same visual rate as narrower ones.
  const bendRadius = (width / 2) / Math.sin(CARD_CURVE_ANGLE / 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = x / (width / 2); // -1..1 across the card
    const theta = t * (CARD_CURVE_ANGLE / 2);
    const newX = Math.sin(theta) * bendRadius;
    const newZ = bendRadius - Math.cos(theta) * bendRadius; // bow away from camera (+Z, deeper into scene)
    pos.setX(i, newX);
    pos.setZ(i, newZ);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  curvedGeometryCache.set(key, geo);
  return geo;
}

// Same size/curve as getCurvedGeometry, but keeps BOTH forms: the base
// `position` attribute is the flat plane, and a companion `aCurved`
// attribute holds the bent version. A vertex shader lerps between them by a
// `flatten` uniform so the focused card can straighten out as it's pulled
// from the ring.
const morphGeometryCache = new Map<string, THREE.BufferGeometry>();
function getMorphGeometry(width: number, height: number) {
  const key = `${width.toFixed(3)}x${height.toFixed(3)}`;
  const cached = morphGeometryCache.get(key);
  if (cached) return cached;

  const geo = new THREE.PlaneGeometry(width, height, CARD_SEGMENTS, 1);
  const flat = geo.attributes.position;
  const curved = new Float32Array(flat.count * 3);
  const bendRadius = (width / 2) / Math.sin(CARD_CURVE_ANGLE / 2);
  for (let i = 0; i < flat.count; i++) {
    const x = flat.getX(i);
    const y = flat.getY(i);
    const t = x / (width / 2);
    const theta = t * (CARD_CURVE_ANGLE / 2);
    curved[i * 3] = Math.sin(theta) * bendRadius;
    curved[i * 3 + 1] = y;
    curved[i * 3 + 2] = bendRadius - Math.cos(theta) * bendRadius;
  }
  geo.setAttribute("aCurved", new THREE.BufferAttribute(curved, 3));
  return morphGeometryCache.get(key) ?? (morphGeometryCache.set(key, geo), geo);
}

// Shared across every card — avoids constructing a loader (and its internal
// image cache bookkeeping) 144 times over for a 48-box gallery.
const sharedTextureLoader = new THREE.TextureLoader();

// Vertex shader for the focused card: lerp each vertex between its flat
// (`position`) and curved (`aCurved`) form by the `flatten` uniform.
const FOCUS_VERTEX = /* glsl */ `
  attribute vec3 aCurved;
  uniform float flatten; // 1 = flat, 0 = fully curved like in the drum
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = mix(aCurved, position, flatten);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FOCUS_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  uniform float saturation; // 1 = full colour (focused), 0 = b&w (matches drum)
  uniform float aspect;     // card width / height, so the corner radius stays round
  uniform float radius;     // corner radius in units of the card's HALF-HEIGHT
  varying vec2 vUv;
  vec3 sRGBToLinear(vec3 c) {
    return mix(c * 0.0773993808, pow(c * 0.9478672986 + 0.0521327014, vec3(2.4)), step(0.04045, c));
  }
  vec3 linearToSRGB(vec3 c) {
    return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }
  // Same rounded-rect clip the drum cards use, so the corners stay rounded
  // as a card flies out of the ring and becomes the focused hero.
  float roundedRectAlpha(vec2 uv, float ar, float r) {
    vec2 ext = vec2(ar, 1.0);
    r = min(r, min(ext.x, ext.y));
    vec2 p = (uv - 0.5) * 2.0 * ext;
    vec2 d = abs(p) - (ext - r);
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
    return 1.0 - smoothstep(-fwidth(dist), fwidth(dist), dist);
  }
  void main() {
    vec4 tex = texture2D(map, vUv);
    vec3 lin = sRGBToLinear(tex.rgb);
    float gray = dot(lin, vec3(0.299, 0.587, 0.114));
    vec3 mixed = mix(vec3(gray), lin, saturation);
    float corner = roundedRectAlpha(vUv, aspect, radius);
    gl_FragColor = vec4(linearToSRGB(mixed), tex.a * opacity * corner);
  }
`;

// Cards sit desaturated by default and, on hover, colour sweeps across the
// card as a diagonal wipe — with a bright band of light riding the wipe's
// leading edge — instead of a flat crossfade. A single shared shader (a
// couple of uniforms per instance) drives the whole thing frame to frame.
const GRAYSCALE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const GRAYSCALE_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float reveal;   // 0 = fully b&w, 1 = fully colour — animates the wipe
  uniform float time;     // seconds, for the subtle living shimmer on the edge
  uniform float entrance; // 0..1 fade-in alpha for the load-time assembly
  uniform float aspect;   // card width / height, so the corner radius stays round
  uniform float radius;   // corner radius in units of the card's HALF-HEIGHT
  varying vec2 vUv;

  // Signed distance to a rounded rectangle — used to clip the card's corners
  // so the textured plane reads as a rounded photo, not a hard rectangle.
  float roundedRectAlpha(vec2 uv, float ar, float r) {
    // Work in a space where 1 unit = half the card height; x scaled by aspect.
    vec2 ext = vec2(ar, 1.0);          // half-extents of the card in this space
    r = min(r, min(ext.x, ext.y));      // never larger than the shorter half-edge
    vec2 p = (uv - 0.5) * 2.0 * ext;
    vec2 d = abs(p) - (ext - r);
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
    // Anti-alias the edge with one screen pixel of feather.
    return 1.0 - smoothstep(-fwidth(dist), fwidth(dist), dist);
  }

  // Raw ShaderMaterial never gets Three's automatic sRGB texture decode
  // that meshBasicMaterial applies for you — sample manually here, once,
  // or colours read washed out / mismatched against the rest of the scene.
  vec3 sRGBToLinear(vec3 c) {
    return mix(c * 0.0773993808, pow(c * 0.9478672986 + 0.0521327014, vec3(2.4)), step(0.04045, c));
  }
  vec3 linearToSRGB(vec3 c) {
    return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }

  void main() {
    vec4 tex = texture2D(map, vUv);
    vec3 linearColor = sRGBToLinear(tex.rgb);
    float gray = dot(linearColor, vec3(0.299, 0.587, 0.114));

    // Diagonal coordinate, 0 at bottom-left, 1 at top-right. The wipe front
    // sweeps along this axis as 'reveal' animates 0 -> 1.
    float diag = (vUv.x + vUv.y) * 0.5;
    // A little wobble on the wipe line so it isn't a dead-straight edge.
    float wobble = sin(vUv.y * 14.0 + time * 3.0) * 0.02;
    float front = reveal * 1.2 - 0.1 + wobble; // slight over-travel so it fully clears

    // Colour behind the front, b&w ahead of it, soft transition between.
    float colored = smoothstep(front - 0.08, front, diag);
    colored = 1.0 - colored;
    vec3 mixed = mix(vec3(gray), linearColor, colored);

    // Bright light band riding exactly on the wipe boundary — brightest at
    // the seam, fading out to either side, and only while mid-sweep.
    float band = 1.0 - smoothstep(0.0, 0.05, abs(diag - front));
    float sweeping = reveal * (1.0 - reveal) * 4.0; // peaks mid-animation, 0 at rest
    mixed += band * sweeping * 0.6;

    float corner = roundedRectAlpha(vUv, aspect, radius);
    gl_FragColor = vec4(linearToSRGB(mixed), tex.a * entrance * corner);
  }
`;

// Corner radius as a fraction of each card's half-height. Kept in
// height-relative units so portrait and landscape cards round identically.
// Small — reads as ~4px, matching the index preview / detail hero corners.
const CARD_CORNER_RADIUS = 0.02;

const TEXTURE_WIDTH = 640; // requested px width — cards are small on screen, originals can be 2000px+

// Route the image through Next's built-in optimizer so the GPU only ever
// has to decode/hold a downscaled copy, not the multi-megapixel original —
// the single biggest lever on texture memory and decode cost at 144 cards.
function optimizedSrc(src: string) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${TEXTURE_WIDTH}&q=75`;
}

// Single flat image card, facing the cylinder's centre. Loads its own aspect
// ratio so portrait stays tall, landscape stays wide — nothing is cropped.
// b&w by default; colour + pop on hover; a click opens its detail view.
function ImageCard({
  item,
  selected,
  entranceDelay,
  leanRef,
  registry,
  onSelect,
}: {
  item: PlacedImage;
  selected: boolean;
  entranceDelay: number;                 // seconds before this card's load-time fade-in starts
  leanRef: React.RefObject<number>;      // shared signed yaw (radians) — the drum's inertia lean
  registry: SelectRegistry | null;       // canonical band copy only — prev/next selects through this
  onSelect: (sel: Selection) => void;
}) {
  const [aspect, setAspect] = useState<number | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const popRef = useRef<THREE.Group>(null);   // lifts + scales the card toward the camera on hover
  const leanGroupRef = useRef<THREE.Group>(null); // yaws with the drum's momentum
  const targetReveal = useRef(0);
  const currentReveal = useRef(0);
  const currentPop = useRef(0);
  // Time since this card's texture became ready — drives the entrance
  // fade/scale, offset by entranceDelay so the ring assembles staggered.
  const entranceT = useRef(0);

  useEffect(() => {
    // A selected card is hidden (its focused twin is showing), and must come
    // back grayscale — the focused card finishes its own colour->b&w on
    // close, so the drum card should already be at reveal 0 when it reappears
    // rather than flashing the stale hovered colour.
    targetReveal.current = hovered && !selected ? 1 : 0;
  }, [hovered, selected]);

  // While hidden as the selected card, snap the drum copy's colour state to
  // b&w so there's no colour pop at the handoff back into the ring.
  useEffect(() => {
    if (selected) { currentReveal.current = 0; targetReveal.current = 0; }
  }, [selected]);

  useFrame((state, delta) => {
    const smoothing = 1 - Math.pow(2, -delta / SATURATION_HALF_LIFE);
    currentReveal.current += (targetReveal.current - currentReveal.current) * smoothing;

    // Entrance: clock starts once the texture is ready, each card offset by
    // its own delay. Eased fade + grow-in; runs once, then sits at 1.
    if (texture) entranceT.current += delta;
    const et = THREE.MathUtils.clamp((entranceT.current - entranceDelay) / ENTRANCE_DURATION, 0, 1);
    const entrance = 1 - Math.pow(1 - et, 3); // ease-out cubic

    if (materialRef.current) {
      materialRef.current.uniforms.reveal.value = currentReveal.current;
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.entrance.value = entrance;
    }
    // Hovered card lifts toward the camera and scales up a touch, so it
    // separates from the drum instead of staying flush in the ring.
    currentPop.current += ((hovered ? 1 : 0) - currentPop.current) * smoothing;
    if (popRef.current) {
      const s = 1 + currentPop.current * 0.12;
      const grow = ENTRANCE_FROM_SCALE + (1 - ENTRANCE_FROM_SCALE) * entrance;
      popRef.current.scale.setScalar(s * grow);
      popRef.current.position.z = currentPop.current * 0.5; // toward centre/camera
    }
    // Momentum lean, shared across all cards (written by the Drum per frame).
    if (leanGroupRef.current) {
      leanGroupRef.current.rotation.y = leanRef.current ?? 0;
    }
  });

  useEffect(() => {
    let cancelled = false;
    sharedTextureLoader.load(optimizedSrc(item.src), (tex) => {
      if (cancelled) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      // Cards are always near-frontal and roughly on-size — skip mipmap
      // generation (real cost per 640px texture x144 cards) in favour of
      // a plain linear filter.
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      const img = tex.image as HTMLImageElement;
      if (img?.naturalWidth && img?.naturalHeight) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
      setTexture(tex);
    });
    return () => { cancelled = true; };
  }, [item.src]);

  const ar = aspect ?? 0.75; // portrait guess until the real ratio is known
  const width = ar >= 1 ? CARD_MAX_LANDSCAPE : CARD_MAX * ar;
  const height = ar >= 1 ? CARD_MAX_LANDSCAPE / ar : CARD_MAX;
  const geometry = useMemo(() => getCurvedGeometry(width, height), [width, height]);
  const uniforms = useMemo(
    () => ({
      map: { value: texture },
      reveal: { value: 0 },
      time: { value: 0 },
      entrance: { value: 0 },
      aspect: { value: width / height },
      radius: { value: CARD_CORNER_RADIUS },
    }),
    [texture, width, height]
  );

  // Capture two poses (force a world-matrix refresh first — R3F hasn't
  // re-flushed this tick):
  //   start = the mesh's LIVE world matrix, including the current hover pop,
  //   so the transition begins from exactly the size/position the card is at.
  //   rest  = the INNER group (mesh -> popGroup -> leanGroup -> innerGroup),
  //   the un-popped, un-leaned resting pose the drum card returns to, so the
  //   close lands there with no jump.
  // Shared by the click handler (fly-in) and the prev/next registry (parked).
  const selectNow = (parked: boolean) => {
    const mesh = meshRef.current;
    if (!mesh || !texture) return;
    const innerGroup = mesh.parent?.parent?.parent ?? mesh;
    mesh.updateWorldMatrix(true, false);
    const startPos = new THREE.Vector3();
    const startQuat = new THREE.Quaternion();
    const startScale = new THREE.Vector3();
    mesh.matrixWorld.decompose(startPos, startQuat, startScale);
    const restPos = new THREE.Vector3();
    const restQuat = new THREE.Quaternion();
    const restScale = new THREE.Vector3();
    innerGroup.matrixWorld.decompose(restPos, restQuat, restScale);
    // Clear hover here: once selected, the mesh unmounts and its
    // onPointerOut never fires, so `hovered` would stay stuck true and the
    // card would re-appear coloured after the panel closes.
    setHovered(false);
    onSelect({ item, startPos, startQuat, startScale, restPos, restQuat, restScale, startTexture: texture, startAspect: ar, parked });
  };

  // Keep the registry pointing at the latest closure (texture/aspect update
  // as they load). No dep list on purpose — a ref write per render is cheap.
  const selectNowRef = useRef(selectNow);
  useEffect(() => {
    selectNowRef.current = selectNow;
  });
  useEffect(() => {
    if (!registry?.current) return;
    const reg = registry.current;
    reg.set(item.uid, () => selectNowRef.current(true));
    return () => { reg.delete(item.uid); };
  }, [registry, item.uid]);

  // The selected card is rendered separately as the focused card, so hide
  // its in-drum copy to avoid a doubled image.
  if (!texture || selected) return null;

  return (
    // Outer group: swing to this card's angular slot around the drum.
    <group rotation={[0, item.angle, 0]}>
      {/* Inner group: sit out at the radius, add the small individual tilt,
          and face back toward the centre. The geometry itself bows into a
          shallow arc so each card reads as curved, not flat. */}
      <group position={[0, item.yOffset, -RADIUS]} rotation={[0, item.tilt, 0]}>
        {/* Lean group: yaws with the drum's momentum (inertia lean). */}
        <group ref={leanGroupRef}>
        {/* Pop group: scales + lifts the card toward the camera on hover. */}
        <group ref={popRef}>
          <mesh
            ref={meshRef}
            geometry={geometry}
            // Hovered card draws last so, as it pops toward the camera, it
            // isn't clipped by neighbours that were drawn after it (with the
            // corner-radius alpha the cards are transparent, and same-order
            // transparent meshes sort by draw order, not depth — a popped
            // card would otherwise get sliced by an adjacent card's plane).
            renderOrder={hovered ? 1 : 0}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
            onClick={(e) => {
              e.stopPropagation();
              selectNow(false);
            }}
          >
            <shaderMaterial
              ref={materialRef}
              uniforms={uniforms}
              vertexShader={GRAYSCALE_VERTEX}
              fragmentShader={GRAYSCALE_FRAGMENT}
              transparent
            />
          </mesh>
        </group>
        </group>
      </group>
    </group>
  );
}

// The clicked card, lifted out of the drum: a flat (uncurved), straightened,
// full-colour plane parked in front of the camera and shifted left so the
// HTML detail panel has room on the right. Animates in/out via a 0->1 t.
// Cubic ease-in-out — smoother accel/decel than a plain half-life lerp for
// the focus transition, so the hero eases both out of and into rest.
function easeInOut(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// The clicked card, pulled continuously out of the ring. It renders at the
// scene root and interpolates its full world transform (position, rotation,
// scale) from exactly where the drum card was — captured on click — to the
// flat, straightened, parked hero pose, while a shader morphs the geometry
// from curved to flat. Closing runs the identical path in reverse.
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _identQuat = new THREE.Quaternion();

function FocusedCard({
  sel,
  closing,
  photoSrc,
  onExited,
}: {
  sel: Selection;
  closing: boolean;
  photoSrc: string;
  onExited: () => void;
}) {
  const { startPos, startQuat, startScale, restPos, restQuat, restScale, startTexture, startAspect } = sel;
  // Start from the drum card's already-decoded texture/aspect so the hero is
  // visible on the very first frame — no vanish-then-pop while the hi-res
  // copy streams in. Swap to the sharper texture once it arrives, and again
  // whenever the panel's photo strip steps to a different photo.
  const [texture, setTexture] = useState<THREE.Texture>(startTexture);
  // Aspect starts at the clicked card's ratio (so the fly-in matches the drum
  // card), but must UPDATE when the photo strip steps to a different photo —
  // a portrait sibling was being stretched into the first photo's landscape
  // geometry otherwise.
  const [aspect, setAspect] = useState<number>(startAspect);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  // Parked selections (prev/next navigation) start fully open — a direct
  // swap in place rather than replaying the fly-in from the ring.
  const p = useRef(sel.parked ? 1 : 0); // raw progress 0..1 (eased below)
  const exited = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // Larger load for the hero view — the small drum texture would look soft
    // blown up this large. Stick to w=1200 / q=75 (both on Next's default
    // allow-lists; a non-listed width or quality returns HTTP 400).
    const src = `/_next/image?url=${encodeURIComponent(photoSrc)}&w=1200&q=75`;
    sharedTextureLoader.load(src, (tex) => {
      if (cancelled) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      // Re-measure the real aspect of whichever photo this is, so the geometry
      // (below) reshapes for portrait vs landscape siblings.
      const img = tex.image as HTMLImageElement | undefined;
      if (img?.naturalWidth && img?.naturalHeight) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
      setTexture(tex);
    });
    return () => { cancelled = true; };
  }, [photoSrc]);

  // Same base geometry size as the drum card — including the landscape size
  // bump — so the pulled card is literally the same shape at t=0 AND lands
  // back at exactly the drum card's size on close (a mismatched base here
  // made landscape photos visibly pop ~9% larger at the return handoff).
  const ar = aspect;
  const width = ar >= 1 ? CARD_MAX_LANDSCAPE : CARD_MAX * ar;
  const height = ar >= 1 ? CARD_MAX_LANDSCAPE / ar : CARD_MAX;
  const geometry = useMemo(() => getMorphGeometry(width, height), [width, height]);
  // Keep the same uniforms object for the material's whole life — the `map`
  // and `aspect` values are pushed imperatively in useFrame instead, so the
  // material never re-creates (which would flash) when the photo or its
  // orientation changes mid-focus.
  const uniforms = useMemo(
    () => ({
      map: { value: startTexture },
      flatten: { value: 0 },
      opacity: { value: 1 },
      saturation: { value: 1 },
      aspect: { value: width / height },
      radius: { value: CARD_CORNER_RADIUS },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startTexture]
  );

  // Parked target: fit inside the hero box keeping aspect, expressed as a
  // uniform scale on the base geometry. On phones the detail panel is a
  // bottom sheet (not a right-hand column), so the hero parks centred
  // horizontally in the band above the sheet instead of pushed left —
  // sized against the actual visible area at the hero's depth.
  const { size: canvasSize } = useThree();
  const isNarrow = canvasSize.width < 640;
  const worldH = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * Math.abs(FOCUS_Z);
  const worldW = worldH * (canvasSize.width / canvasSize.height);
  const maxW = isNarrow ? worldW - 0.3 : FOCUS_MAX_W;
  const maxH = isNarrow ? worldH * 0.34 : FOCUS_MAX_H;
  const parkedFit = Math.min(maxW / (width), maxH / (height));
  const endScale = parkedFit;
  const endPos = useMemo(
    () => (isNarrow ? new THREE.Vector3(0, worldH * 0.23, FOCUS_Z) : new THREE.Vector3(FOCUS_X, 0, FOCUS_Z)),
    [isNarrow, worldH]
  );

  useFrame((_, delta) => {
    // Once the close has fully played out we've asked the parent to unmount
    // us; freeze here so a stray render where `closing` briefly reads false
    // (while `selected` hasn't cleared yet) can't flip us back to "opening"
    // and pop the card colored + scaled up for a frame.
    if (exited.current) return;

    // Steady progress + ease, so open and close trace the same smooth path.
    // Clamp delta so a single stalled frame (tab refocus, GC pause) can't
    // jump progress from 1 straight to 0 and make the close look instant.
    const dt = Math.min(delta, 1 / 30);
    const dir = closing ? -1 : 1;
    const duration = closing ? FOCUS_CLOSE_DURATION : FOCUS_DURATION;
    p.current = THREE.MathUtils.clamp(p.current + dir * dt / duration, 0, 1);
    // Both directions ease in-and-out: motion is spread evenly across the
    // whole duration and glides to a gentle stop at each end. (A front-loaded
    // ease-out made the scale-down finish in the first ~half then sit still,
    // which read as a jump to the small size.)
    const e = easeInOut(p.current);
    const mesh = meshRef.current;
    if (mesh) {
      // Drum-side pose: opening leaves from the LIVE clicked pose (`start`,
      // whatever hover-pop it was at) so there's no jump at click; closing
      // returns to the un-popped REST pose the drum card will render, so
      // there's no jump at the handoff back.
      const drumPos = closing ? restPos : startPos;
      const drumQuat = closing ? restQuat : startQuat;
      const drumScaleX = closing ? restScale.x : startScale.x;
      // Position: drum card's world position -> parked hero position.
      _tmpPos.copy(drumPos).lerp(endPos, e);
      mesh.position.copy(_tmpPos);
      // Rotation: card's world orientation -> straight-on (identity).
      _tmpQuat.copy(drumQuat).slerp(_identQuat, e);
      mesh.quaternion.copy(_tmpQuat);
      // Scale: card's world scale -> parked uniform scale.
      const sc = THREE.MathUtils.lerp(drumScaleX, endScale, e);
      mesh.scale.setScalar(sc);
    }
    if (matRef.current) {
      matRef.current.uniforms.flatten.value = e;         // curved -> flat
      matRef.current.uniforms.map.value = texture;       // low-res -> hi-res swap, no re-create
      matRef.current.uniforms.aspect.value = width / height; // keeps corner SDF round when a portrait/landscape sibling loads
      // Full colour while opening / focused. On close, hold the colour while
      // the card is still large and only drain it over the back half of the
      // return — so it reads as "big + colour, THEN shrinks to small + b&w"
      // rather than desaturating and shrinking in one blended motion.
      matRef.current.uniforms.saturation.value = closing
        ? THREE.MathUtils.clamp((e - 0.15) / 0.5, 0, 1)
        : 1;
    }
    if (closing && p.current <= 0 && !exited.current) {
      exited.current = true;
      onExited();
    }
  });

  return (
    // Start exactly at the captured drum-card pose; useFrame drives it onward.
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={startPos}
      quaternion={startQuat}
      scale={startScale.x}
      renderOrder={20}
      onClick={(e) => e.stopPropagation()}
    >
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={FOCUS_VERTEX}
        fragmentShader={FOCUS_FRAGMENT}
        transparent
        depthTest={false}
      />
    </mesh>
  );
}

// A full-viewport black plane parked close to the camera that fades in when a
// card is focused — darkens the whole busy ring so the hero + detail panel
// read cleanly. renderOrder places it above the drum but below the hero, and
// depthTest off means its own world-z never matters for sorting.
function Dimmer({ closing, target, onClose }: { closing: boolean; target: number; onClose: () => void }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const o = useRef(0);
  useFrame((_, delta) => {
    const want = closing ? 0 : target;
    o.current += (want - o.current) * (1 - Math.pow(2, -delta / FOCUS_HALF_LIFE));
    if (matRef.current) matRef.current.opacity = o.current;
  });
  // Sits between the camera and the drum, so it also acts as an interaction
  // shield: pointer events hit it (not the cards behind), which blocks
  // hovering/clicking the gallery while a card is focused. A click on it
  // closes, like clicking the backdrop of a lightbox.
  return (
    <mesh
      position={[0, 0, -1]}
      renderOrder={10}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial ref={matRef} color="#000000" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// Faint graph-paper grid on the void behind the drum. A single static plane
// parked behind everything the camera can see (the camera never rotates —
// only the drum does — so one plane covers the whole view). It runs through
// the same post pipeline as the rest of the scene, so the vignette fades it
// toward the edges and the motion smear drags it along with a fast spin;
// the drum's parallax drifting over the still grid adds a little depth.
const GRID_LINE_ALPHA = 0.016;  // line brightness on black — a whisper
const GRID_FADE_DELAY = 0.4;    // seconds before the grid starts fading in
const GRID_FADE_DURATION = 1.6; // seconds for the fade itself
const GRID_FALLOFF_IN = 6.0;    // world units from centre where the radial fade starts
const GRID_FALLOFF_OUT = 22.0;  // world units where the grid has fully dissolved
const GRID_FRAGMENT = /* glsl */ `
  uniform float fade; // 0..1 fade-in after load
  varying vec2 vUv;
  void main() {
    // ~2 world-unit square cells on the 120x80 plane.
    vec2 coord = vUv * vec2(60.0, 40.0);
    // Anti-aliased 1px lines at every cell boundary (fwidth keeps them one
    // screen pixel wide regardless of distance/warp).
    vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);
    // Radial falloff (in world units from the plane's centre): the grid
    // only really lives in the middle of the frame and dissolves well
    // before the screen edges — the vignette finishes the job.
    vec2 p = (vUv - 0.5) * vec2(120.0, 80.0);
    float fall = 1.0 - smoothstep(${GRID_FALLOFF_IN.toFixed(1)}, ${GRID_FALLOFF_OUT.toFixed(1)}, length(p));
    gl_FragColor = vec4(vec3(line * ${GRID_LINE_ALPHA.toFixed(3)} * fade * fall), 1.0);
  }
`;

function BackgroundGrid() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ fade: { value: 0 } }), []);

  // Ease the grid in after a short beat, so the drum assembles first and
  // the graph paper surfaces quietly underneath it.
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = THREE.MathUtils.clamp((elapsed.current - GRID_FADE_DELAY) / GRID_FADE_DURATION, 0, 1);
    if (materialRef.current) {
      materialRef.current.uniforms.fade.value = t * t * (3 - 2 * t); // smoothstep
    }
  });

  // No pointer handlers, so it never blocks card hovers or the
  // click-empty-space-to-close behaviour.
  return (
    <mesh position={[0, 0, -24]}>
      <planeGeometry args={[120, 80]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={GRAYSCALE_VERTEX}
        fragmentShader={GRID_FRAGMENT}
        depthWrite={false}
      />
    </mesh>
  );
}

// Scroll-driven rotation + vertical drift of the whole drum, plus a passive
// auto-spin that eases in after a moment of no scroll input, and a subtle
// mouse-parallax tilt layered on top (cheap — just extra rotation math, no
// new geometry or draw calls).
function Drum({
  items,
  yBand,
  selectedUid,
  lastPhotoByUid,
  velocityRef,
  registry,
  onSelect,
}: {
  items: PlacedImage[];
  yBand: number;
  selectedUid: string | null;
  lastPhotoByUid: Record<string, string>;
  velocityRef: React.RefObject<number>; // smoothed 0..1 scroll speed, read by the post pass
  registry: SelectRegistry;             // uid -> programmatic select, for prev/next navigation
  onSelect: (sel: Selection) => void;
}) {
  const spinRef = useRef<THREE.Group>(null);   // scroll rotation + vertical drift + idle auto-spin
  const parallaxRef = useRef<THREE.Group>(null); // mouse-driven tilt, layered outside the spin

  const targetRot = useRef(0);
  const currentRot = useRef(0);
  const targetY = useRef(0);
  const currentY = useRef(0);
  const lastInputAt = useRef(0);
  const idleSpinPhase = useRef(0); // accumulates independently so it keeps spinning smoothly once idle

  const mouseTarget = useRef({ x: 0, y: 0 });   // -1..1, raw pointer position
  const parallaxCurrent = useRef({ x: 0, y: 0 });

  // Previous frame's pose, for measuring the drum's actual speed (which
  // drives the post pass's motion-smear streaks and the cards' inertia lean).
  const prevRot = useRef(0);
  const prevY = useRef(0);
  const leanRef = useRef(0); // signed card yaw, radians — read by every ImageCard

  // Freeze drum input while a card is focused, so the ring holds still
  // behind the detail view. A ref keeps the listeners (registered once)
  // reading the current value without re-binding.
  const frozen = useRef(false);
  useEffect(() => { frozen.current = selectedUid !== null; }, [selectedUid]);

  useEffect(() => {
    lastInputAt.current = performance.now();

    function registerInput() { lastInputAt.current = performance.now(); }

    function onWheel(e: WheelEvent) {
      // Not passive: this gesture drives the drum, not the page — without
      // preventDefault the browser ALSO scrolls the real page underneath,
      // so everything (including the fixed Share/Sign-out buttons) visibly
      // jumps in sync with the rotation.
      e.preventDefault();
      if (frozen.current) return;
      targetRot.current += e.deltaY * SCROLL_TO_RADIANS;
      targetY.current += e.deltaY * SCROLL_TO_Y;
      registerInput();
    }
    let lastX = 0;
    let lastY = 0;
    function onTouchStart(e: TouchEvent) { lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
    function onTouchMove(e: TouchEvent) {
      // Frozen = detail panel open — bail BEFORE preventDefault so the
      // panel's own touch scrolling stays native.
      if (frozen.current) return;
      // Like the wheel handler: this gesture drives the drum, not the page.
      // Without preventDefault the browser also rubber-bands/scrolls the
      // page in sync with the rotation (needs passive: false below).
      e.preventDefault();
      const dx = lastX - e.touches[0].clientX;
      const dy = lastY - e.touches[0].clientY;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      targetRot.current += dx * SCROLL_TO_RADIANS * 3;
      targetY.current += dy * SCROLL_TO_Y * 3;
      registerInput();
    }
    function onPointerMove(e: PointerEvent) {
      mouseTarget.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTarget.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  useFrame((_, delta) => {
    // Exponential smoothing tied to real elapsed time, not frame count, so
    // the glide feels identical at 30fps, 60fps, or 120fps — and a
    // half-life curve reads as smoother than a fixed-ratio lerp because it
    // never fully "catches up and stops" the instant a scroll tick lands.
    // While a card is focused the drum must be completely still — otherwise
    // residual scroll damping, idle spin, or parallax keep nudging the cards,
    // so the card returns to a slightly different spot than where its focused
    // twin was captured. Snap every motion target to its current value and
    // hold, so the world pose stays exactly as it was at click time.
    if (frozen.current) {
      targetRot.current = currentRot.current;
      targetY.current = currentY.current;
      mouseTarget.current.x = parallaxCurrent.current.x;
      mouseTarget.current.y = parallaxCurrent.current.y;
    }

    const smoothing = 1 - Math.pow(2, -delta / SMOOTHING_HALF_LIFE);
    currentRot.current += (targetRot.current - currentRot.current) * smoothing;
    currentY.current += (targetY.current - currentY.current) * smoothing;

    // Auto-spin: only once the user has been quiet for a beat, and eased in
    // rather than snapped on, so it never feels like a jarring hand-off.
    // Suspended entirely while a card is focused.
    const idleMs = performance.now() - lastInputAt.current;
    const idleT = frozen.current
      ? 0
      : THREE.MathUtils.clamp((idleMs - IDLE_DELAY) / (IDLE_FADE_IN * 1000), 0, 1);
    const idleStrength = idleT * idleT * (3 - 2 * idleT); // smoothstep
    idleSpinPhase.current += IDLE_SPIN_SPEED * idleStrength * delta;

    if (spinRef.current) {
      spinRef.current.rotation.y = currentRot.current + idleSpinPhase.current;
      spinRef.current.position.y = THREE.MathUtils.euclideanModulo(currentY.current, yBand);
    }

    // Measure the drum's actual speed (rotation + vertical drift, using the
    // UNWRAPPED y so the band-modulo jump above doesn't spike it) and smooth
    // it into a 0..1 envelope for the post pass's motion-smear streaks.
    const frameRot = currentRot.current + idleSpinPhase.current;
    const dt = Math.max(delta, 1e-4);
    const rotVel = (frameRot - prevRot.current) / dt; // signed, rad/s
    const ySpeed = Math.abs(currentY.current - prevY.current) / dt;
    prevRot.current = frameRot;
    prevY.current = currentY.current;
    const rawSpeed = Math.min(1, Math.abs(rotVel) / SMEAR_ROT_FULL + ySpeed / SMEAR_Y_FULL);
    velocityRef.current += (rawSpeed - velocityRef.current) * (1 - Math.pow(2, -delta / SMEAR_RESPONSE));

    // Inertia lean: signed, so the cards yaw INTO the direction of spin and
    // swing back through upright as it settles.
    const leanTarget = THREE.MathUtils.clamp(rotVel / LEAN_FULL_SPEED, -1, 1) * LEAN_MAX;
    leanRef.current += (leanTarget - leanRef.current) * (1 - Math.pow(2, -delta / LEAN_RESPONSE));

    // Mouse parallax: gently settle toward the pointer's position, offset
    // as a small extra yaw/pitch on an outer wrapper so it never interferes
    // with the scroll/idle rotation state above.
    const pSmoothing = 1 - Math.pow(2, -delta / PARALLAX_HALF_LIFE);
    parallaxCurrent.current.x += (mouseTarget.current.x - parallaxCurrent.current.x) * pSmoothing;
    parallaxCurrent.current.y += (mouseTarget.current.y - parallaxCurrent.current.y) * pSmoothing;
    if (parallaxRef.current) {
      parallaxRef.current.rotation.y = parallaxCurrent.current.x * PARALLAX_ROT_STRENGTH;
      parallaxRef.current.rotation.x = parallaxCurrent.current.y * PARALLAX_TILT_STRENGTH;
    }
  });

  return (
    <group ref={parallaxRef}>
      <group ref={spinRef}>
        {/* Each card renders three times, stacked one yBand apart, so the
            vertical wrap never shows a gap or pop at the seam. */}
        {[0, yBand, -yBand].map((bandOffset) =>
          items.map((item, i) => (
            <ImageCard
              key={`${i}-${bandOffset}`}
              item={{
                ...item,
                yOffset: item.yOffset + bandOffset,
                // The panel's photo carousel can step through a box's other
                // photos while it's open — carry that choice back onto the
                // drum card so it keeps showing the same photo after the
                // panel closes, not always the box's original cover photo.
                src: lastPhotoByUid[item.uid] ?? item.src,
              }}
              selected={selectedUid === item.uid}
              // Hash-based stagger reads organic (not a mechanical sweep);
              // keyed on the item index so a card's three band copies share
              // one delay and assemble as a single card.
              entranceDelay={hash(i * 7.31) * ENTRANCE_STAGGER}
              leanRef={leanRef}
              // Only the canonical (bandOffset 0) copy registers for
              // programmatic prev/next — the wrap copies share its uid.
              registry={bandOffset === 0 ? registry : null}
              onSelect={onSelect}
            />
          ))
        )}
      </group>
    </group>
  );
}

const FISHEYE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const EDGE_BLUR_STRENGTH = 0.0022;  // max blur-sample offset, in UV units, at the frame edge
const EDGE_FADE_STRENGTH = 0.55;    // how much the outer ring darkens (0 = none, 1 = fades to black)
const GRAIN_STRENGTH = 0.05;        // film-grain intensity, added over the whole frame

// Motion smear for the top/bottom bands — while the drum is moving, the
// outer rows drag into long vertical streaks pointing off the frame, like a
// long-exposure photo of the cylinder spinning. Streak length follows the
// drum's smoothed scroll speed, so a still drum renders perfectly clean.
const SMEAR_START = 0.55;           // |vertical distance from centre| where the smear begins, 0..1
const SMEAR_LEN = 0.16;             // max streak length at full speed, as a fraction of frame height
const SMEAR_RESPONSE = 0.15;        // seconds for the streak envelope to close half its gap — eases in/out
const SMEAR_ROT_FULL = 2.5;         // rotation speed (rad/s) that maps to full streak
const SMEAR_Y_FULL = 8;             // vertical drift speed (world units/s) that maps to full streak

// Inertia lean — cards yaw into the direction of rotation while the drum
// spins, and spring back upright as it settles, so the ring feels dragged
// by momentum rather than rigidly bolted together.
const LEAN_MAX = 0.22;              // max card yaw, radians (~12.5°), at full rotation speed
const LEAN_FULL_SPEED = 2.5;        // rotation speed (rad/s) that maps to the full lean
const LEAN_RESPONSE = 0.18;         // seconds for the lean to close half its gap — the "spring"

// Entrance build — on first load each card fades/scales into the ring on
// its own small delay, so the drum assembles instead of popping in whole.
const ENTRANCE_DURATION = 0.7;      // seconds for one card's fade/scale-in
const ENTRANCE_STAGGER = 0.9;       // max extra delay across cards, seconds
const ENTRANCE_FROM_SCALE = 0.6;    // cards grow from this scale to 1

const FISHEYE_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float strength;
  uniform float blurAmount;
  uniform float fadeAmount;
  uniform float grain;
  uniform float time;
  uniform float smear; // 0..1, the drum's smoothed scroll speed
  uniform vec3 fadeColor; // page background — the vignette/edge fade mixes TOWARD this, not toward black
  varying vec2 vUv;

  // The render target holds linear data (nothing in this custom pass ever
  // applies Three's usual sRGB output encode automatically, unlike its
  // built-in materials) — encode to sRGB by hand before this reaches the
  // screen, once, here.
  vec3 linearToSRGB(vec3 c) {
    return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }

  // Cheap per-pixel hash for animated film grain — reseeded every frame by
  // folding 'time' into the coordinate so the noise crawls instead of
  // sitting static like a fixed texture.
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    // Distance from vertical centre, -1..1. Push the sample point further
    // from centre as we approach the top/bottom edges, which reads as the
    // image bending/compressing inward — the "melting into the void" look.
    // Clamp (not discard) so the edge pixel stretches instead of leaving a
    // hard black bar where the sample would otherwise fall outside [0,1].
    float t = (vUv.y - 0.5) * 2.0;
    float bend = t * t * t * strength;
    float bentY = vUv.y + bend * 0.5;
    // How far bentY has been pushed past the valid [0,1] range. Once a
    // bunch of screen rows all clamp to the same boundary source row, a
    // hard clamp would repeat that row into a smeared streak — fading to
    // black over that overshoot instead hides the repeat.
    float overshoot = max(-bentY, bentY - 1.0);
    float edgeFade = 1.0 - smoothstep(0.0, 0.05, overshoot);
    vec2 uv = vec2(vUv.x, clamp(bentY, 0.0, 1.0));

    // ── Motion smear over the top/bottom bands ──────────────────────────
    // While the drum is moving, the outer rows drag into vertical streaks
    // pointing off the frame — a long-exposure trail of the spin. The smear
    // uniform is the drum's smoothed scroll speed; still drum = clean frame.
    float vEdge = smoothstep(${SMEAR_START.toFixed(2)}, 1.0, abs(t));
    float streak = smear * vEdge * ${SMEAR_LEN.toFixed(2)};
    float dirY = sign(t); // drag outward, away from the centre of frame

    // Fade + blur toward the edges (replaces the earlier chromatic
    // aberration effect) — clean and sharp in the centre of frame, softly
    // out of focus and darkened toward the outer ring, echoing a lens
    // vignette rather than a glitchy RGB split.
    vec2 fromCentre = uv - 0.5;
    float dist = clamp(length(fromCentre) * 1.6, 0.0, 1.0);
    float edgeMask = smoothstep(0.35, 1.0, dist);

    float blurRadius = blurAmount * edgeMask;
    vec4 blurred = texture2D(tDiffuse, uv) * 0.4;
    blurred += texture2D(tDiffuse, clamp(uv + vec2(blurRadius, 0.0), 0.0, 1.0)) * 0.15;
    blurred += texture2D(tDiffuse, clamp(uv - vec2(blurRadius, 0.0), 0.0, 1.0)) * 0.15;
    blurred += texture2D(tDiffuse, clamp(uv + vec2(0.0, blurRadius), 0.0, 1.0)) * 0.15;
    blurred += texture2D(tDiffuse, clamp(uv - vec2(0.0, blurRadius), 0.0, 1.0)) * 0.15;

    // Streak accumulation: a trail of samples pulled from toward the centre
    // of frame, weights fading along the trail — content gets dragged
    // outward into the void while the drum is in motion. The whole trail is
    // gated by streak length so a still drum leaves the base blur untouched
    // (ungated, six same-spot taps would dilute it).
    float trailOn = smoothstep(0.0, 0.02, streak);
    float wsum = 1.0;
    for (int i = 1; i <= 6; i++) {
      float f = float(i) / 6.0;
      float w = (1.0 - f * 0.85) * trailOn;
      blurred += texture2D(tDiffuse, clamp(uv - vec2(0.0, dirY * f * streak), 0.0, 1.0)) * w;
      wsum += w;
    }
    blurred /= wsum;

    // Vignette + edge overshoot both fade TOWARD the page background colour
    // via mix() (fadeColor is black in the current dark theme, so this reads
    // the same as fading to black — but keeping it as a uniform, rather than
    // a hardcoded multiply, means a future theme change is a colour swap,
    // not a shader rewrite).
    vec3 color = linearToSRGB(blurred.rgb);
    color = mix(color, fadeColor, edgeMask * fadeAmount);
    color = mix(fadeColor, color, edgeFade);

    // Animated film grain over the whole frame — subtle, luminance-aware so
    // it reads as texture in the mids rather than crushing the blacks.
    float g = hash21(vUv * 900.0 + fract(time) * 100.0) - 0.5;
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color += g * grain * (0.4 + lum * 0.6);

    gl_FragColor = vec4(color, blurred.a);
  }
`;

// Renders the drum scene to an offscreen target, then draws it back through
// a fullscreen shader that bends the top/bottom rows inward and refracts
// them through fluted glass ribs — one extra render + one fullscreen
// triangle, far cheaper than a full postprocessing dependency.
function FisheyePost({
  children,
  velocityRef,
}: {
  children: React.ReactNode;
  velocityRef: React.RefObject<number>; // drum scroll speed, 0..1, written by Drum each frame
}) {
  const { gl, size, viewport, scene: mainScene } = useThree();
  const fxScene = useMemo(() => new THREE.Scene(), []);
  const fxCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  // No colorSpace override here — the renderer writes linear data into this
  // target during the offscreen pass, and sRGB encoding is applied once, by
  // the renderer itself, only on the final pass to the screen. Tagging this
  // target as sRGB mislabels already-linear data and caused a double encode
  // (crushed-dark image) when read back by the plain texture2D() fetch above.
  const renderTarget = useMemo(
    () => new THREE.WebGLRenderTarget(size.width * viewport.dpr, size.height * viewport.dpr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    // Match the canvas's actual framebuffer resolution (CSS size x device
    // pixel ratio) — without the dpr factor this target stays at 1x on
    // retina displays while the canvas renders at 1.5-2x, so the final
    // pass upscales a soft, blurry copy back onto a sharp canvas.
    renderTarget.setSize(size.width * viewport.dpr, size.height * viewport.dpr);
  }, [size, viewport.dpr, renderTarget]);

  useEffect(() => {
    return () => renderTarget.dispose();
  }, [renderTarget]);

  const fadeColorVec = useMemo(() => {
    const c = new THREE.Color(BG_COLOR);
    return new THREE.Vector3(c.r, c.g, c.b);
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: renderTarget.texture },
          strength: { value: FISHEYE_STRENGTH },
          blurAmount: { value: EDGE_BLUR_STRENGTH },
          fadeAmount: { value: EDGE_FADE_STRENGTH },
          grain: { value: GRAIN_STRENGTH },
          time: { value: 0 },
          smear: { value: 0 },
          fadeColor: { value: fadeColorVec },
        },
        vertexShader: FISHEYE_VERTEX,
        fragmentShader: FISHEYE_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      }),
    [renderTarget, fadeColorVec]
  );

  /* eslint-disable react-hooks/immutability -- these are the standard R3F
     imperative-render idioms: per-frame uniform writes and temporarily
     toggling renderer state around a manual render-to-target pass. */
  useFrame(({ camera, clock }) => {
    material.uniforms.time.value = clock.elapsedTime;
    material.uniforms.smear.value = velocityRef.current ?? 0;

    // Render the drum into the offscreen target without any output color
    // transform — this pass isn't final output, so the renderer's usual
    // sRGB/tone-mapping encode must be suspended here and applied only once,
    // on the real final pass below, or colors crush and darken.
    const prevToneMapping = gl.toneMapping;
    const prevOutputColorSpace = gl.outputColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;

    gl.setRenderTarget(renderTarget);
    gl.clear();
    gl.render(mainScene, camera);

    gl.toneMapping = prevToneMapping;
    gl.outputColorSpace = prevOutputColorSpace;

    gl.setRenderTarget(null);
    gl.render(fxScene, fxCamera);
  }, 1);
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      {createPortal(children, mainScene)}
      {createPortal(
        <mesh material={material} frustumCulled={false}>
          <planeGeometry args={[2, 2]} />
        </mesh>,
        fxScene
      )}
    </>
  );
}

// Twin of the gallery's SidebarRow: uppercase label left, value right,
// hairline divider on top, translucent-dark backing.
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingBlock: 12,
        borderTop: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          lineHeight: leading.meta,
          letterSpacing: tracking.loose,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          lineHeight: leading.meta,
          letterSpacing: tracking.normal,
          color: "rgba(255,255,255,0.92)",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// HTML detail sidebar pinned to the right — same layout & typography as the
// gallery's DetailPanel (caption line, uppercase title, description, metadata
// rows, map link, close pill), dark themed to match the gallery.
// Slides out when `closing` so the whole focus view exits in sync with the
// hero flying back into the ring.
// Shared circular icon button for the panel header (prev/next/close).
const detailPanelButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  padding: 0,
  borderRadius: "50%",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "rgba(255,255,255,0.85)",
  cursor: "pointer",
  outline: "none",
};

function DetailPanel({
  box,
  closing,
  onClose,
  onNavigate,
  photoIndex,
  onSelectPhoto,
}: {
  box: Box;
  closing: boolean;
  onClose: () => void;
  onNavigate: (dir: -1 | 1) => void;
  photoIndex: number;
  onSelectPhoto: (i: number) => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const visible = shown && !closing;

  // Get the floating nav (mascot + menu) out of the way while the panel owns
  // the screen; it fades back in as the panel starts sliding out.
  useHideNav(visible);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    formatAddress(box.address) + ", Toronto, Ontario"
  )}`;

  // This is a client component (the whole gallery is ssr:false), so `document`
  // is always available by the time it renders — no mount guard needed.
  if (typeof document === "undefined") return null;

  // Portal to <body> so the panel escapes the gallery page's stacking context
  // (which is capped below the site nav), letting its z-index sit above the
  // fixed nav bar.
  return createDomPortal(
    <div
      className="grid-detail-panel"
      style={{
        position: "fixed",
        // Inset on every side so the panel reads as a floating card rather
        // than a full-height sidebar flush to the edges.
        top: 16,
        right: 16,
        bottom: 16,
        width: "min(38vw, 360px)",
        zIndex: 50, // above the site nav (z-index 40) so the panel covers it
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: '"Geist", system-ui, sans-serif',
        pointerEvents: "auto",
        background: "rgba(8,8,8,0.72)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        overflowY: "auto",
        // Slides in from off-screen right and back out on close. The extra
        // 16px clears the inset so it fully leaves the frame. Matches
        // FOCUS_DURATION / FOCUS_CLOSE_DURATION (the hero image's fly-in/out
        // time) so the panel and the image finish animating together.
        transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
        transition: `transform ${closing ? FOCUS_CLOSE_DURATION : FOCUS_DURATION}s cubic-bezier(0.22,1,0.36,1)`,
      }}
    >
      {/* Top bar: prev / next / close (mirrors the index panel header). */}
      <div className="detail-close-bar" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "16px 20px", flexShrink: 0 }}>
        <button onClick={() => onNavigate(-1)} aria-label="Previous box" style={detailPanelButton}>
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <path d="M6.5 1L2.5 5L6.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button onClick={() => onNavigate(1)} aria-label="Next box" style={detailPanelButton}>
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <path d="M3.5 1L7.5 5L3.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button onClick={onClose} aria-label="Close" style={detailPanelButton}>
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="detail-body" style={{ flex: 1, minHeight: 0, padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Caption + title */}
        <div className="detail-title-block" style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 11, lineHeight: leading.caption,
              letterSpacing: tracking.loose, textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)", marginBottom: 6,
            }}
          >
            ({String(box.id).padStart(3, "0")}) {formatNeighbourhood(box.neighbourhood)}
          </span>
          <span
            style={{
              fontSize: 18, lineHeight: leading.subtitle,
              letterSpacing: tracking.normal, textTransform: "uppercase",
              color: "#ffffff",
            }}
          >
            {box.title}
          </span>
        </div>

        {/* Description */}
        {box.description && (
          <p
            style={{
              margin: 0, fontSize: 13, lineHeight: leading.body,
              letterSpacing: tracking.normal, color: "rgba(255,255,255,0.7)",
              textWrap: "pretty",
            } as React.CSSProperties}
          >
            {box.description}
          </p>
        )}

        {/* Metadata rows */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <DetailRow label="Artist" value={box.artist} />
          <DetailRow label="Year" value={formatYear(box.year)} />
          <DetailRow label="Neighbourhood" value={formatNeighbourhood(box.neighbourhood)} />
          <DetailRow
            label="Location"
            value={
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "rgba(255,255,255,0.92)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}
              >
                {formatAddress(box.address)}
                <span style={{ fontSize: 10, display: "inline-block", transform: "rotate(45deg) scaleX(-1)", lineHeight: 1 }}>↑</span>
              </a>
            }
          />
        </div>

        {/* Photo strip — click a thumbnail to swap the hero image in place
            (no re-run of the fly-in/out animation). Only for boxes that
            actually have more than one photo. */}
        {box.images && box.images.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 12, marginTop: -22, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <span
              style={{
                fontSize: 11, lineHeight: leading.meta,
                letterSpacing: tracking.loose, textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Photos
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {box.images.map((src, i) => (
                <div
                  key={src}
                  onClick={() => onSelectPhoto(i)}
                  style={{
                    width: 56, height: 56, flexShrink: 0, position: "relative",
                    cursor: "pointer",
                    outline: i === photoIndex ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.2)",
                    outlineOffset: -1,
                    opacity: i === photoIndex ? 1 : 0.65,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  <Image src={src} alt="" fill style={{ objectFit: "cover" }} sizes="56px" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function CylinderGallery3D({ boxes }: { boxes: Box[] }) {
  // Fixed CARDS_PER_ROW (e.g. 6), spaced evenly by angle with a gap between
  // them — the whole row visible at once, like the reference. More photos
  // means more rows stacked vertically, never more cards squeezed per row.
  const { items, yBand } = useMemo(() => {
    const withUpload = boxes.filter((b) => b.images?.length);
    const n = withUpload.length;
    if (n === 0) return { items: [] as PlacedImage[], yBand: ROW_SPACING };

    // Small collections would leave the drum mostly empty (one sparse row in a
    // sea of black). Instead, tile the collected boxes — repeating them around
    // and down the cylinder — until there are enough to fill a comfortable
    // number of rows, so the drum always feels populated regardless of size.
    const MIN_ROWS = 5;
    const targetCount = Math.max(n, MIN_ROWS * CARDS_PER_ROW);
    const filled: Box[] = Array.from({ length: targetCount }, (_, i) => withUpload[i % n]);

    const numRows = Math.max(1, Math.ceil(filled.length / CARDS_PER_ROW));
    const angleStep = (Math.PI * 2) / CARDS_PER_ROW;
    // Centre the rows vertically around y=0 so the drum starts framed nicely.
    const yStart = -((numRows - 1) * ROW_SPACING) / 2;

    const placed = filled.map((box, i) => {
      const row = Math.floor(i / CARDS_PER_ROW);
      const slot = i % CARDS_PER_ROW;
      // Cards sit at an exact, evenly-spaced slot angle — no per-card jitter
      // on position, so the gap between neighbours is always consistent
      // regardless of each card's own width (portrait vs landscape).
      const angle = slot * angleStep + (row % 2 === 1 ? ROW_ANGLE_OFFSET : 0);
      const tilt = (hash(i + 100) - 0.5) * 2 * JITTER_SEED_SCALE;
      return {
        uid: `${box.id}-${i}`,
        src: box.images![0],
        box,
        angle,
        yOffset: yStart + row * ROW_SPACING,
        tilt,
      };
    });

    return { items: placed, yBand: numRows * ROW_SPACING };
  }, [boxes]);

  // `selected` is the focused selection (kept mounted through the exit
  // animation); `closing` runs the reverse animation, and only once the hero
  // reports it has fully flown back does `selected` clear.
  const [selected, setSelected] = useState<Selection | null>(null);
  const [closing, setClosing] = useState(false);
  // Which of the selected box's photos is showing on the hero / photo strip.
  const [photoIndex, setPhotoIndex] = useState(0);
  // Last-viewed photo per card (by uid), so a drum card that's stepped to a
  // different photo keeps showing it after the panel closes — `selected`
  // clears at the same moment the card returns to the ring, so reading the
  // photo choice off `selected` directly would revert to the cover photo
  // right at the handoff. This map outlives that clear; it's written from
  // the photo strip's click handler, never from an effect.
  const [lastPhotoByUid, setLastPhotoByUid] = useState<Record<string, string>>({});
  // Drum scroll speed (0..1, smoothed), written by Drum each frame and read
  // by FisheyePost to drive the motion-smear streaks — a shared ref, since
  // it changes every frame and must never trigger React renders.
  const scrollVelocity = useRef(0);

  const open = (sel: Selection) => {
    setSelected(sel);
    setClosing(false);
    // The drum card may already be showing a non-cover photo (from a
    // previous visit) — start the photo strip on that photo, not photo 1.
    const imgs = sel.item.box.images ?? [];
    setPhotoIndex(Math.max(0, imgs.indexOf(sel.item.src)));
  };
  const requestClose = () => { if (selected) setClosing(true); };
  const finishClose = () => { setSelected(null); setClosing(false); };

  const photos = selected?.item.box.images ?? [];
  const photoSrc = photos[photoIndex] ?? selected?.item.src ?? "";

  const selectPhoto = (i: number) => {
    setPhotoIndex(i);
    if (selected && photos[i]) {
      setLastPhotoByUid((prev) => ({ ...prev, [selected.item.uid]: photos[i] }));
    }
  };

  // Programmatic card selection for prev/next — each canonical drum card
  // registers itself here (uid -> capture-poses-and-open, like a click).
  const selectRegistry = useRef(new Map<string, () => void>());

  // Step to the adjacent BOX (in the same order as the index list), wrapping
  // at the ends. The drum tiles boxes multiple times, so pick the first
  // placed card showing the target box.
  const navigate = (dir: -1 | 1) => {
    if (!selected || closing) return;
    const idx = boxes.findIndex((b) => b.id === selected.item.box.id);
    if (idx === -1 || boxes.length < 2) return;
    const nextBox = boxes[(idx + dir + boxes.length) % boxes.length];
    const target = items.find((it) => it.box.id === nextBox.id);
    if (target) selectRegistry.current.get(target.uid)?.();
  };

  // Escape closes (like any lightbox); arrows page through boxes.
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, closing]);

  return (
    <div style={{ width: "100%", height: "100%", background: BG_COLOR }}>
      <Canvas
        camera={{ position: [0, 0, 0.01], fov: CAMERA_FOV }}
        gl={{ antialias: true }}
        dpr={[1, 1.5]}
        onPointerMissed={requestClose}
      >
        <FisheyePost velocityRef={scrollVelocity}>
          <color attach="background" args={[BG_COLOR]} />
          <BackgroundGrid />
          <Drum
            items={items}
            yBand={yBand}
            selectedUid={selected?.item.uid ?? null}
            lastPhotoByUid={lastPhotoByUid}
            velocityRef={scrollVelocity}
            registry={selectRegistry}
            onSelect={open}
          />
          {selected && <Dimmer closing={closing} target={DIM_OPACITY} onClose={requestClose} />}
          {selected && (
            // Keyed per card so prev/next remounts the hero for the new box
            // (parked selections render directly in place, no fly-in).
            <FocusedCard key={selected.item.uid} sel={selected} closing={closing} photoSrc={photoSrc} onExited={finishClose} />
          )}
        </FisheyePost>
      </Canvas>

      {selected && (
        <DetailPanel
          box={selected.item.box}
          closing={closing}
          onClose={requestClose}
          onNavigate={navigate}
          photoIndex={photoIndex}
          onSelectPhoto={selectPhoto}
        />
      )}
    </div>
  );
}
