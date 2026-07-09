"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { createPortal as createDomPortal } from "react-dom";
import { Canvas, useFrame, useThree, createPortal } from "@react-three/fiber";
import * as THREE from "three";
import Image from "next/image";
import { type Box, formatNeighbourhood, formatYear, formatAddress } from "@/lib/data";
import { size, tracking, leading } from "@/lib/typography";

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
const CARD_MAX_LANDSCAPE = 2.9;        // landscape cards read a bit small against portraits at the same longest-edge cap — give them a slightly larger one
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

// Focused (clicked) card — a flat hero image parked in front of the camera,
// pushed left so the detail panel fits on the right half of the screen.
const FOCUS_X = -1.6;                  // horizontal offset of the hero image, world units (negative = left)
const FOCUS_Z = -3.2;                  // distance in front of the camera the hero sits, world units
const FOCUS_MAX_W = 3.6;               // max hero width, world units (fit keeps aspect within this box)
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
}

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
  varying vec2 vUv;
  vec3 sRGBToLinear(vec3 c) {
    return mix(c * 0.0773993808, pow(c * 0.9478672986 + 0.0521327014, vec3(2.4)), step(0.04045, c));
  }
  vec3 linearToSRGB(vec3 c) {
    return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }
  void main() {
    vec4 tex = texture2D(map, vUv);
    vec3 lin = sRGBToLinear(tex.rgb);
    float gray = dot(lin, vec3(0.299, 0.587, 0.114));
    vec3 mixed = mix(vec3(gray), lin, saturation);
    gl_FragColor = vec4(linearToSRGB(mixed), tex.a * opacity);
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
  uniform float reveal; // 0 = fully b&w, 1 = fully colour — animates the wipe
  uniform float time;   // seconds, for the subtle living shimmer on the edge
  varying vec2 vUv;

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

    gl_FragColor = vec4(linearToSRGB(mixed), tex.a);
  }
`;

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
  onSelect,
}: {
  item: PlacedImage;
  selected: boolean;
  onSelect: (sel: Selection) => void;
}) {
  const [aspect, setAspect] = useState<number | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [hovered, setHovered] = useState(false);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const popRef = useRef<THREE.Group>(null);   // lifts + scales the card toward the camera on hover
  const targetReveal = useRef(0);
  const currentReveal = useRef(0);
  const currentPop = useRef(0);

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
    if (materialRef.current) {
      materialRef.current.uniforms.reveal.value = currentReveal.current;
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
    // Hovered card lifts toward the camera and scales up a touch, so it
    // separates from the drum instead of staying flush in the ring.
    currentPop.current += ((hovered ? 1 : 0) - currentPop.current) * smoothing;
    if (popRef.current) {
      const s = 1 + currentPop.current * 0.12;
      popRef.current.scale.setScalar(s);
      popRef.current.position.z = currentPop.current * 0.5; // toward centre/camera
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
    () => ({ map: { value: texture }, reveal: { value: 0 }, time: { value: 0 } }),
    [texture]
  );

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
        {/* Pop group: scales + lifts the card toward the camera on hover. */}
        <group ref={popRef}>
          <mesh
            geometry={geometry}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
            onClick={(e) => {
              e.stopPropagation();
              // Capture two poses (force a world-matrix refresh first — R3F
              // hasn't re-flushed this tick):
              //   start = the mesh's LIVE world matrix, including the current
              //   hover pop, so the transition begins from exactly the size /
              //   position the card is at when clicked (even mid-hover).
              //   rest  = the INNER group (mesh -> popGroup -> innerGroup),
              //   the un-popped resting pose the drum card returns to, so the
              //   close lands there with no jump at the handoff.
              const mesh = e.eventObject;
              const innerGroup = mesh.parent?.parent ?? mesh;
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
              // onPointerOut never fires, so `hovered` would stay stuck true
              // and the card would re-appear coloured after the panel closes.
              setHovered(false);
              onSelect({ item, startPos, startQuat, startScale, restPos, restQuat, restScale, startTexture: texture, startAspect: ar });
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

function FocusedCard({ sel, closing, photoSrc, onExited }: { sel: Selection; closing: boolean; photoSrc: string; onExited: () => void }) {
  const { item, startPos, startQuat, startScale, restPos, restQuat, restScale, startTexture, startAspect } = sel;
  // Start from the drum card's already-decoded texture/aspect so the hero is
  // visible on the very first frame — no vanish-then-pop while the hi-res
  // copy streams in. Swap to the sharper texture once it arrives, and again
  // whenever the panel's thumbnail strip switches to a different photo.
  const [texture, setTexture] = useState<THREE.Texture>(startTexture);
  const [aspect] = useState<number>(startAspect); // shape is fixed at click; hi-res swap keeps same aspect
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const p = useRef(0);       // raw progress 0..1 (eased below)
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
      setTexture(tex);
    });
    return () => { cancelled = true; };
  }, [photoSrc]);

  // Same base geometry size as the drum card, so the pulled card is literally
  // the same shape at t=0; the parked size is reached by scaling up.
  const ar = aspect;
  const width = ar >= 1 ? CARD_MAX : CARD_MAX * ar;
  const height = ar >= 1 ? CARD_MAX / ar : CARD_MAX;
  const geometry = useMemo(() => getMorphGeometry(width, height), [width, height]);
  // Keep the same uniforms object across the texture swap and just point its
  // `map` at whichever texture is current (updated in useFrame), so the
  // material never re-creates — which would flash — mid-animation.
  const uniforms = useMemo(
    () => ({ map: { value: startTexture }, flatten: { value: 0 }, opacity: { value: 1 }, saturation: { value: 1 } }),
    [startTexture]
  );

  // Parked target: fit inside the hero box keeping aspect, expressed as a
  // uniform scale on the base geometry.
  const parkedFit = Math.min(FOCUS_MAX_W / (width), FOCUS_MAX_H / (height));
  const endScale = parkedFit;
  const endPos = useMemo(() => new THREE.Vector3(FOCUS_X, 0, FOCUS_Z), []);

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

// Scroll-driven rotation + vertical drift of the whole drum, plus a passive
// auto-spin that eases in after a moment of no scroll input, and a subtle
// mouse-parallax tilt layered on top (cheap — just extra rotation math, no
// new geometry or draw calls).
function Drum({
  items,
  yBand,
  selectedUid,
  onSelect,
}: {
  items: PlacedImage[];
  yBand: number;
  selectedUid: string | null;
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
      if (frozen.current) return;
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
    window.addEventListener("touchmove", onTouchMove, { passive: true });
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
              item={{ ...item, yOffset: item.yOffset + bandOffset }}
              selected={selectedUid === item.uid}
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

const FISHEYE_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float strength;
  uniform float blurAmount;
  uniform float fadeAmount;
  uniform float grain;
  uniform float time;
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

    vec3 color = linearToSRGB(blurred.rgb) * (1.0 - edgeMask * fadeAmount);
    color *= edgeFade;

    // Animated film grain over the whole frame — subtle, luminance-aware so
    // it reads as texture in the mids rather than crushing the blacks.
    float g = hash21(vUv * 900.0 + fract(time) * 100.0) - 0.5;
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color += g * grain * (0.4 + lum * 0.6);

    gl_FragColor = vec4(color, blurred.a);
  }
`;

// Renders the drum scene to an offscreen target, then draws it back through
// a fullscreen shader that bends the top/bottom rows inward — one extra
// render + one fullscreen triangle, far cheaper than a full postprocessing
// dependency for a single effect.
function FisheyePost({ children }: { children: React.ReactNode }) {
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
        },
        vertexShader: FISHEYE_VERTEX,
        fragmentShader: FISHEYE_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      }),
    [renderTarget]
  );

  /* eslint-disable react-hooks/immutability -- these are the standard R3F
     imperative-render idioms: per-frame uniform writes and temporarily
     toggling renderer state around a manual render-to-target pass. */
  useFrame(({ camera, clock }) => {
    material.uniforms.time.value = clock.elapsedTime;

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
          fontSize: size.caption,
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
          fontSize: size.meta,
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
function DetailPanel({
  box,
  closing,
  onClose,
  photoIndex,
  onSelectPhoto,
}: {
  box: Box;
  closing: boolean;
  onClose: () => void;
  photoIndex: number;
  onSelectPhoto: (i: number) => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const visible = shown && !closing;

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
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
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
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        overflowY: "auto",
        // Slides in fully from off-screen right — "pushed in" from the edge —
        // and slides back out the same way on close. Matches FOCUS_DURATION /
        // FOCUS_CLOSE_DURATION (the hero image's fly-in/out time) so the
        // panel and the image finish animating together in both directions.
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: `transform ${closing ? FOCUS_CLOSE_DURATION : FOCUS_DURATION}s cubic-bezier(0.22,1,0.36,1)`,
      }}
    >
      {/* Top bar: close pill on the right (mirrors the gallery panel header). */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "16px 20px", flexShrink: 0 }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 38, height: 38, padding: 0, borderRadius: "50%",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer", outline: "none",
          }}
        >
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Caption + title */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: size.caption, lineHeight: leading.caption,
              letterSpacing: tracking.loose, textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)", marginBottom: 6,
            }}
          >
            ({String(box.id).padStart(3, "0")}) {formatNeighbourhood(box.neighbourhood)}
          </span>
          <span
            style={{
              fontSize: size.subtitle, lineHeight: leading.subtitle,
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
              margin: 0, fontSize: size.meta, lineHeight: leading.body,
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

        {/* Additional photos — click a thumbnail to swap the focused hero's
            texture in place, without re-running the fly-in/out animation. */}
        {box.images && box.images.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span
              style={{
                fontSize: size.caption, lineHeight: leading.meta,
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
  // Which of the selected box's photos the hero + panel are showing — reset
  // whenever a new card is opened so it always starts on the cover photo.
  const [photoIndex, setPhotoIndex] = useState(0);

  const open = (sel: Selection) => { setSelected(sel); setClosing(false); setPhotoIndex(0); };
  const requestClose = () => { if (selected) setClosing(true); };
  const finishClose = () => { setSelected(null); setClosing(false); };

  const photos = selected?.item.box.images ?? [];
  const photoSrc = photos[photoIndex] ?? selected?.item.src ?? "";

  // Close on Escape, like any lightbox.
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") requestClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div style={{ width: "100%", height: "100%", background: "#000000" }}>
      <Canvas
        camera={{ position: [0, 0, 0.01], fov: 85 }}
        gl={{ antialias: true }}
        dpr={[1, 1.5]}
        onPointerMissed={requestClose}
      >
        <FisheyePost>
          <color attach="background" args={["#000000"]} />
          <Drum
            items={items}
            yBand={yBand}
            selectedUid={selected?.item.uid ?? null}
            onSelect={open}
          />
          {selected && <Dimmer closing={closing} target={DIM_OPACITY} onClose={requestClose} />}
          {selected && (
            <FocusedCard sel={selected} closing={closing} photoSrc={photoSrc} onExited={finishClose} />
          )}
        </FisheyePost>
      </Canvas>

      {selected && (
        <DetailPanel
          box={selected.item.box}
          closing={closing}
          onClose={requestClose}
          photoIndex={photoIndex}
          onSelectPhoto={setPhotoIndex}
        />
      )}
    </div>
  );
}
