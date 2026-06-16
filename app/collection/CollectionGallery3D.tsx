"use client";

import { useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { type Box } from "@/lib/data";

const CARD_H = 1.8;
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 1.78;
const MAX_ASPECT_MOBILE = 0.95;
const GAP = 0.28;
const ARC_DEPTH = 2.2;
const ARC_TILT = 0.55;
const FOCUS_SCALE = 1.0;
const EDGE_SCALE = 0.82;
const EDGE_DIM = 0.55;
const DAMPING = 0.88;
const SENSITIVITY = 0.004;
const SATURATION = 1.15;

function clampAspect(a: number) {
  return Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, a));
}

function cardTransform(offset: number) {
  const t = Math.abs(offset);
  const z = -Math.min(t, 3) * (ARC_DEPTH / 3);
  const ry = -Math.sign(offset) * Math.min(t, 3) * (ARC_TILT / 3);
  const scale = THREE.MathUtils.lerp(FOCUS_SCALE, EDGE_SCALE, Math.min(t / 3, 1));
  const dim = THREE.MathUtils.lerp(1.0, EDGE_DIM, Math.min(t / 3, 1));
  return { z, ry, scale, dim };
}

// Shader that applies saturation + per-card dim in one pass
const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D uMap;
  uniform float uSaturation;
  uniform float uDim;
  varying vec2 vUv;

  void main() {
    vec4 c = texture2D(uMap, vUv);
    // Luminance-preserving saturation
    float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 sat = mix(vec3(luma), c.rgb, uSaturation);
    gl_FragColor = vec4(sat * uDim, 1.0);
  }
`;

function makeMaterial(tex?: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex ?? null },
      uSaturation: { value: tex ? SATURATION : 0.0 },
      uDim: { value: 1.0 },
    },
    vertexShader,
    fragmentShader,
  });
}

function Gallery({ boxes, onSelect, userPhotos, isMobile }: { boxes: Box[]; onSelect: (box: Box) => void; userPhotos: Record<number, string>; isMobile: boolean }) {
  const { scene, camera } = useThree();
  const focusRef = useRef(0);
  const targetFocus = useRef(0);
  // Debounce timer: after scroll/swipe stops, snap targetFocus to the nearest card.
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const layoutRef = useRef<{ cx: number; hw: number }[]>([]);
  const mouse = useRef({ x: 0, y: 0 });
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (boxes.length === 0) return;

    const loader = new THREE.TextureLoader();
    const meshes: THREE.Mesh[] = [];
    const layout: { cx: number; hw: number }[] = [];

    let cursorX = 0;
    boxes.forEach((box, i) => {
      const defaultAspect = 0.8;
      const w = CARD_H * defaultAspect;
      const hw = w / 2;
      const cx = cursorX + hw;
      layout.push({ cx, hw });
      cursorX = cx + hw + GAP;

      const geo = new THREE.PlaneGeometry(w, CARD_H);
      const mat = makeMaterial();
      // Start invisible — revealed once texture is ready to avoid grey flash
      mat.uniforms.uDim.value = 0;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = cx;
      scene.add(mesh);
      meshes.push(mesh);

      loader.load(userPhotos[box.id] ?? box.images![0], (tex) => {
        const img = tex.image as HTMLImageElement;
        const aspect = clampAspect(img.naturalWidth / img.naturalHeight);
        const cardH = (isMobile && aspect > 1) ? CARD_H * 0.72 : CARD_H;
        const newW = cardH * aspect;

        const newGeo = new THREE.PlaneGeometry(newW, cardH);
        mesh.geometry.dispose();
        mesh.geometry = newGeo;

        layout[i].hw = newW / 2;
        let x = i === 0 ? 0 : layout[i - 1].cx + layout[i - 1].hw + GAP;
        for (let j = i; j < layout.length; j++) {
          layout[j].cx = x + layout[j].hw;
          x = layout[j].cx + layout[j].hw + GAP;
          meshes[j].position.x = layout[j].cx;
        }

        const shader = mesh.material as THREE.ShaderMaterial;
        shader.uniforms.uMap.value = tex;
        shader.uniforms.uSaturation.value = SATURATION;
        shader.needsUpdate = true;
        mesh.userData.ready = true;
      });
    });

    meshesRef.current = meshes;
    layoutRef.current = layout;

    return () => {
      meshes.forEach((m) => {
        scene.remove(m);
        m.geometry.dispose();
        (m.material as THREE.ShaderMaterial).dispose();
      });
    };
  }, [scene, boxes]);

  useEffect(() => {
    const el = document.querySelector("canvas");
    if (!el) return;

    // After input stops, snap to the nearest whole card.
    const scheduleSnap = () => {
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        targetFocus.current = Math.max(
          0,
          Math.min(meshesRef.current.length - 1, Math.round(targetFocus.current))
        );
      }, 90);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      targetFocus.current = Math.max(
        0,
        Math.min(meshesRef.current.length - 1, targetFocus.current + delta * SENSITIVITY)
      );
      scheduleSnap();
    };

    let lx = 0;
    const onTouchStart = (e: TouchEvent) => { lx = e.touches[0].clientX; };
    const onTouchMove = (e: TouchEvent) => {
      const dx = lx - e.touches[0].clientX;
      lx = e.touches[0].clientX;
      targetFocus.current = Math.max(
        0,
        Math.min(meshesRef.current.length - 1, targetFocus.current + dx * SENSITIVITY * 2)
      );
    };
    const onTouchEnd = () => scheduleSnap();

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Click → raycast → open lightbox for the hit card
  useEffect(() => {
    const el = document.querySelector("canvas");
    if (!el) return;
    const raycaster = new THREE.Raycaster();

    const onClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hits = raycaster.intersectObjects(meshesRef.current);
      if (hits.length > 0) {
        const idx = meshesRef.current.indexOf(hits[0].object as THREE.Mesh);
        if (idx >= 0 && boxesRef.current[idx]) {
          onSelectRef.current(boxesRef.current[idx]);
        }
      }
    };

    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [camera]);

  useFrame(({ camera }) => {
    focusRef.current += (targetFocus.current - focusRef.current) * (1 - DAMPING);
    const f = focusRef.current;

    const layout = layoutRef.current;
    const fi = Math.min(Math.floor(f), layout.length - 1);
    const frac = f - fi;
    const aX = layout[fi]?.cx ?? fi * 2;
    const bX = layout[Math.min(fi + 1, layout.length - 1)]?.cx ?? aX;
    const targetCamX = THREE.MathUtils.lerp(aX, bX, Math.max(0, frac));

    camera.position.x += (targetCamX - camera.position.x) * 0.1;
    camera.position.y += (-mouse.current.y * 0.15 - camera.position.y) * 0.06;

    meshesRef.current.forEach((mesh, i) => {
      const offset = i - f;
      const { z, ry, scale, dim } = cardTransform(offset);
      mesh.position.z = z;
      mesh.rotation.y = ry;
      mesh.scale.setScalar(scale);
      // Only show once texture is loaded — fade in smoothly
      const shader = mesh.material as THREE.ShaderMaterial;
      if (mesh.userData.ready) {
        shader.uniforms.uDim.value += (dim - shader.uniforms.uDim.value) * 0.08;
      }
    });
  });

  return null;
}

export default function CollectionGallery3D({ boxes, onSelect, userPhotos = {} }: { boxes: Box[]; onSelect: (box: Box) => void; userPhotos?: Record<number, string> }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  return (
    <Canvas
      camera={{ position: [0, 0, isMobile ? 6.5 : 4], fov: 46 }}
      gl={{ antialias: true, alpha: false }}
      style={{ width: "100%", height: "100%", background: "#FFFFFF" }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#FFFFFF"]} />
      <Suspense fallback={null}>
        <Gallery boxes={boxes} onSelect={onSelect} userPhotos={userPhotos} isMobile={isMobile} />
      </Suspense>
    </Canvas>
  );
}
