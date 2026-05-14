"use client";

import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Box } from "@/lib/data";

function imgUrl(id: number, w: number, h: number) {
  return `https://picsum.photos/seed/box${id}/${w}/${h}`;
}

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function FloatingCard({
  box,
  position,
  rotationY,
  rotationZ,
  onSelect,
}: {
  box: Box;
  position: [number, number, number];
  rotationY: number;
  rotationZ: number;
  onSelect: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const texture = useTexture(imgUrl(box.id, 400, 520));
  const phase = useRef(seededRandom(box.id * 7) * Math.PI * 2);
  const baseY = position[1];

  useFrame((state) => {
    if (!meshRef.current) return;
    // gentle float
    meshRef.current.position.y =
      baseY + Math.sin(state.clock.elapsedTime * 0.4 + phase.current) * 0.12;
    // hover scale
    const target = hovered ? 1.07 : 1;
    meshRef.current.scale.x += (target - meshRef.current.scale.x) * 0.1;
    meshRef.current.scale.y += (target - meshRef.current.scale.y) * 0.1;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[0, rotationY, rotationZ]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <planeGeometry args={[2.8, 3.8]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function Scene({
  boxes,
  onGridSelect,
}: {
  boxes: Box[];
  onGridSelect: (box: Box) => void;
}) {
  const cards = useMemo(
    () =>
      boxes.map((box) => ({
        box,
        position: [
          (seededRandom(box.id * 3 + 1) - 0.5) * 24,
          (seededRandom(box.id * 3 + 2) - 0.5) * 12,
          (seededRandom(box.id * 3 + 3) - 0.5) * 30,
        ] as [number, number, number],
        rotationY: (seededRandom(box.id * 5 + 1) - 0.5) * 0.5,
        rotationZ: (seededRandom(box.id * 5 + 2) - 0.5) * 0.15,
      })),
    [boxes]
  );

  return (
    <>
      {cards.map(({ box, position, rotationY, rotationZ }) => (
        <Suspense key={box.id} fallback={null}>
          <FloatingCard
            box={box}
            position={position}
            rotationY={rotationY}
            rotationZ={rotationZ}
            onSelect={() => onGridSelect(box)}
          />
        </Suspense>
      ))}
    </>
  );
}

export default function GridView3D({
  boxes,
  onGridSelect,
}: {
  boxes: Box[];
  collected: Set<number>;
  onCollect: (id: number) => void;
  onGridSelect: (box: Box) => void;
}) {
  return (
    <div style={{ flex: 1, position: "relative" }}>
      <Canvas
        camera={{ position: [0, 0, 22], fov: 55 }}
        style={{ background: "#F5F5F3" }}
      >
        <fog attach="fog" args={["#F5F5F3", 18, 50]} />
        <ambientLight intensity={1.5} />
        <Scene boxes={boxes} onGridSelect={onGridSelect} />
        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          autoRotate
          autoRotateSpeed={0.3}
          enableZoom
          minDistance={3}
          maxDistance={40}
          enablePan
          screenSpacePanning
        />
      </Canvas>

      {/* Hint */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          translate: "-50%",
          fontSize: 11,
          letterSpacing: "-0.04em",
          fontWeight: 500,
          textTransform: "uppercase",
          color: "#A8A8A8",
          pointerEvents: "none",
          fontFamily: '"Geist", system-ui, sans-serif',
        }}
      >
        Drag to orbit · Right-drag to pan · Scroll to zoom · Click to view
      </div>
    </div>
  );
}
