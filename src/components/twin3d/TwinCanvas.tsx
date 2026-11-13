"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

export default function TwinCanvas() {
  return (
    <div style={{ width: "100%", height: "80vh", background: "#020817" }}>
      <Canvas camera={{ position: [0, 1, 4], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} />
        <mesh position={[0, 1, 0]}>
          <capsuleGeometry args={[0.35, 1.2, 8, 16]} />
          <meshStandardMaterial color="#22d3ee" wireframe />
        </mesh>
        <OrbitControls target={[0, 1, 0]} />
      </Canvas>
    </div>
  );
}