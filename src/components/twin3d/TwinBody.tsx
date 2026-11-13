"use client";

// The 3D digital twin. A see-through body with a skeleton and organs inside.
// Each organ takes its colour from the patient's live twin state, the heart
// beats at the stored heart rate, and the lungs move at the stored breathing
// rate. Clicking an organ selects its region.
//
// The body is built from simple shapes in code, so it needs no model file.
// It can later be swapped for a detailed anatomy model with the same region names.
import { useRef } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Region, Status, TwinState } from "@/lib/engine/types";

const STATUS_COLOR: Record<Status, string> = {
  within: "#34d399",
  watch: "#fbbf24",
  outside: "#f87171",
  no_data: "#94a3b8",
};

const SHELL = "#22d3ee";
const HALF_PI = Math.PI / 2;

type Vec3 = [number, number, number];
type Scalable = { scale: { set: (x: number, y: number, z: number) => void } };

// One piece of the outer body: a faint fill plus a wireframe, for a hologram look.
// It ignores clicks so that the organs inside can be selected.
function ShellPart({ kind, args, position, rotation, scale }: { kind: "sphere" | "capsule" | "cylinder"; args: number[]; position: Vec3; rotation?: Vec3; scale?: Vec3 }) {
  const geometry = () => {
    if (kind === "sphere") return <sphereGeometry args={[args[0], 20, 14]} />;
    if (kind === "capsule") return <capsuleGeometry args={[args[0], args[1], 6, 14]} />;
    return <cylinderGeometry args={[args[0], args[0], args[1], 14]} />;
  };
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh raycast={() => null}>
        {geometry()}
        <meshStandardMaterial color={SHELL} transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <mesh raycast={() => null}>
        {geometry()}
        <meshBasicMaterial color={SHELL} wireframe transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Shell() {
  const side = (x: number, sign: number): number => x * sign;
  return (
    <group>
      <ShellPart kind="sphere" args={[0.115]} position={[0, 1.63, 0]} scale={[0.95, 1.1, 1]} />
      <ShellPart kind="cylinder" args={[0.045, 0.09]} position={[0, 1.49, 0]} />
      <ShellPart kind="capsule" args={[0.17, 0.3]} position={[0, 1.22, 0]} scale={[1.05, 1, 0.62]} />
      <ShellPart kind="capsule" args={[0.155, 0.12]} position={[0, 0.93, 0]} scale={[1, 1, 0.62]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <ShellPart kind="capsule" args={[0.05, 0.26]} position={[side(0.26, s), 1.25, 0]} rotation={[0, 0, side(0.12, s)]} />
          <ShellPart kind="capsule" args={[0.042, 0.25]} position={[side(0.31, s), 0.93, 0]} rotation={[0, 0, side(0.08, s)]} />
          <ShellPart kind="sphere" args={[0.045]} position={[side(0.335, s), 0.74, 0]} />
          <ShellPart kind="capsule" args={[0.075, 0.34]} position={[side(0.09, s), 0.62, 0]} />
          <ShellPart kind="capsule" args={[0.055, 0.36]} position={[side(0.09, s), 0.2, 0]} />
          <ShellPart kind="sphere" args={[0.06]} position={[side(0.09, s), 0.03, 0.05]} scale={[0.8, 0.5, 1.6]} />
        </group>
      ))}
    </group>
  );
}

interface BodyProps {
  state: TwinState | null;
  selected: Region;
  onSelect: (region: Region) => void;
}

function Body({ state, selected, onSelect }: BodyProps) {
  const heart = useRef<Scalable | null>(null);
  const lungLeft = useRef<Scalable | null>(null);
  const lungRight = useRef<Scalable | null>(null);
  const still = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const heartRate = state ? state.metrics.hr.value : 0;
  const breathRate = state ? state.metrics.rr.value : 0;

  // Runs every frame: the heart pulses at the stored heart rate and the lungs
  // swell at the stored respiratory rate, so the body moves with the data.
  useFrame(({ clock }) => {
    if (still.current) return;
    const t = clock.getElapsedTime();

    const beatPhase = (t * heartRate) / 60;
    const beat = heartRate > 0 ? Math.max(0, Math.sin(beatPhase * 2 * Math.PI)) ** 6 : 0;
    const h = 1 + 0.16 * beat;
    heart.current?.scale.set(h, h, h);

    const breath = breathRate > 0 ? (Math.sin((t * breathRate * 2 * Math.PI) / 60) + 1) / 2 : 0;
    const l = 1 + 0.07 * breath;
    lungLeft.current?.scale.set(0.07 * l, 0.13 * l, 0.075 * l);
    lungRight.current?.scale.set(0.07 * l, 0.13 * l, 0.075 * l);
  });

  const status = (region: Region): Status => (state ? state.regions[region] : "no_data");
  const glow = (region: Region) => (selected === region ? 1.8 : 0.9);

  // Shared behaviour for anything clickable.
  const pick = (region: Region) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(region);
    },
    onPointerOver: () => {
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "auto";
    },
  });

  const organMaterial = (region: Region) => (
    <meshStandardMaterial color={STATUS_COLOR[status(region)]} emissive={STATUS_COLOR[status(region)]} emissiveIntensity={glow(region)} transparent opacity={0.92} />
  );
  const boneMaterial = () => (
    <meshStandardMaterial color="#e2e8f0" emissive="#e2e8f0" emissiveIntensity={selected === "skeleton" ? 1.2 : 0.35} transparent opacity={0.75} />
  );
  const bone = (key: string, position: Vec3, length: number, rotation?: Vec3) => (
    <mesh key={key} position={position} rotation={rotation} {...pick("skeleton")}>
      <cylinderGeometry args={[0.011, 0.011, length, 8]} />
      {boneMaterial()}
    </mesh>
  );

  return (
    <group>
      <Shell />

      {/* Skeleton: spine, ribs, pelvis and limb bones */}
      {bone("spine", [0, 1.2, -0.04], 0.62)}
      {[1.38, 1.31, 1.24, 1.17].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[HALF_PI, 0, 0]} scale={[1, 0.6, 1]} {...pick("skeleton")}>
          <torusGeometry args={[0.135, 0.006, 6, 32]} />
          {boneMaterial()}
        </mesh>
      ))}
      <mesh position={[0, 0.92, 0]} rotation={[HALF_PI, 0, 0]} scale={[1, 0.6, 1]} {...pick("skeleton")}>
        <torusGeometry args={[0.11, 0.012, 6, 32]} />
        {boneMaterial()}
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          {bone("upper-arm", [0.26 * s, 1.25, 0], 0.3, [0, 0, 0.12 * s])}
          {bone("forearm", [0.31 * s, 0.93, 0], 0.28, [0, 0, 0.08 * s])}
          {bone("thigh", [0.09 * s, 0.62, 0], 0.42)}
          {bone("shin", [0.09 * s, 0.2, 0], 0.4)}
        </group>
      ))}

      {/* Brain */}
      <mesh position={[0, 1.65, 0]} scale={[0.95, 0.85, 1.1]} {...pick("brain")}>
        <sphereGeometry args={[0.08, 24, 18]} />
        {organMaterial("brain")}
      </mesh>

      {/* Lungs */}
      <mesh
        ref={(m) => {
          lungLeft.current = m;
        }}
        position={[-0.085, 1.29, 0]}
        scale={[0.07, 0.13, 0.075]}
        {...pick("lungs")}
      >
        <sphereGeometry args={[1, 24, 18]} />
        {organMaterial("lungs")}
      </mesh>
      <mesh
        ref={(m) => {
          lungRight.current = m;
        }}
        position={[0.085, 1.29, 0]}
        scale={[0.07, 0.13, 0.075]}
        {...pick("lungs")}
      >
        <sphereGeometry args={[1, 24, 18]} />
        {organMaterial("lungs")}
      </mesh>

      {/* Heart, drawn slightly in front of the lungs */}
      <group position={[0.02, 1.27, 0.045]}>
        <mesh
          ref={(m) => {
            heart.current = m;
          }}
          {...pick("heart")}
        >
          <sphereGeometry args={[0.048, 24, 18]} />
          {organMaterial("heart")}
        </mesh>
      </group>

      {/* Whole-body core: a soft glow in the torso driven by temperature */}
      <mesh position={[0, 1.02, 0]} scale={[1, 0.8, 0.6]} {...pick("body")}>
        <sphereGeometry args={[0.085, 20, 14]} />
        <meshStandardMaterial color={STATUS_COLOR[status("body")]} emissive={STATUS_COLOR[status("body")]} emissiveIntensity={glow("body") * 0.7} transparent opacity={0.45} />
      </mesh>

      {/* Hologram platform */}
      <mesh position={[0, -0.02, 0]} rotation={[HALF_PI, 0, 0]} raycast={() => null}>
        <torusGeometry args={[0.55, 0.006, 6, 64]} />
        <meshBasicMaterial color={SHELL} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, -0.02, 0]} rotation={[HALF_PI, 0, 0]} raycast={() => null}>
        <torusGeometry args={[0.4, 0.003, 6, 64]} />
        <meshBasicMaterial color={SHELL} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export default function TwinBody({ state, selected, onSelect }: BodyProps) {
  return (
    <div style={{ width: "100%", height: 520 }} role="img" aria-label="Interactive 3D body showing the status of each region">
      <Canvas camera={{ position: [0, 1.05, 2.9], fov: 40 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 3, 3]} intensity={1.1} />
        <pointLight position={[-2, 1.5, 2]} intensity={0.6} color={SHELL} />
        <Body state={state} selected={selected} onSelect={onSelect} />
        <OrbitControls target={[0, 0.9, 0]} enablePan={false} minDistance={1.2} maxDistance={5} autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
