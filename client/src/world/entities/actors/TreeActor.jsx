/**
 * TreeActor.jsx
 * 
 * Renderização de uma árvore (TREE)
 * Não interativa, mais um elemento decorativo/ambiental
 */
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { getActorConfig } from "./ActorMappings";

export function TreeActor({ actor }) {
  const trunkRef = useRef();
  const leavesRef = useRef();
  const [hovered, setHovered] = useState(false);
  const config = getActorConfig("TREE");

  // Vento suave: movimento das folhas
  useFrame(({ clock }) => {
    if (leavesRef.current) {
      const windStrength = 0.02;
      const windSpeed = 1;
      leavesRef.current.rotation.z = Math.sin(clock.elapsedTime * windSpeed) * windStrength;
      leavesRef.current.rotation.x = Math.cos(clock.elapsedTime * windSpeed * 0.5) * windStrength * 0.5;
    }
  });

  return (
    <group position={[actor.pos.x, actor.pos.y ?? 0, actor.pos.z]}>
      {/* Tronco */}
      <mesh ref={trunkRef} position={[0, 1, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
        <meshStandardMaterial
          color={0x654321}
          metalness={0}
          roughness={0.9}
          emissive={hovered ? 0x332200 : 0x000000}
        />
      </mesh>

      {/* Folhagem (copa) */}
      <group
        ref={leavesRef}
        position={[0, 2.5, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {/* Esfera principal de folhas */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[1.5, 8, 8]} />
          <meshStandardMaterial
            color={config.color}
            metalness={0.1}
            roughness={0.8}
            emissive={hovered ? 0x2d5a2d : 0x000000}
          />
        </mesh>

        {/* Esferas secundárias para volume */}
        <mesh position={[-0.8, 0.3, 0]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial
            color={0x1a7a1a}
            metalness={0.05}
            roughness={0.85}
          />
        </mesh>

        <mesh position={[0.8, 0.3, 0]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial
            color={0x1a7a1a}
            metalness={0.05}
            roughness={0.85}
          />
        </mesh>

        <mesh position={[0, -0.5, 0.8]}>
          <sphereGeometry args={[1.2, 6, 6]} />
          <meshStandardMaterial
            color={0x1f8b1f}
            metalness={0.08}
            roughness={0.82}
          />
        </mesh>
      </group>

      {/* Raízes (decorativo) */}
      <mesh position={[0.4, 0, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color={0x4a3015} roughness={0.95} />
      </mesh>
      <mesh position={[-0.4, 0, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color={0x4a3015} roughness={0.95} />
      </mesh>
    </group>
  );
}