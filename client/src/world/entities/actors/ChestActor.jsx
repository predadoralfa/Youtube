/**
 * ChestActor.jsx
 * 
 * Renderização de um baú (CHEST)
 * Interativo: clique abre inventário
 */
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { getActorConfig } from "./ActorMappings";

export function ChestActor({ actor, onInteract }) {
  const groupRef = useRef();
  const lidRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const config = getActorConfig("CHEST");

  // Animação de abertura da tampa
  useFrame(() => {
    if (lidRef.current) {
      const targetRotation = isOpen ? Math.PI / 4 : 0;
      lidRef.current.rotation.x += (targetRotation - lidRef.current.rotation.x) * 0.1;
    }

    // Efeito hover: flutuação suave
    if (groupRef.current) {
      groupRef.current.position.y = actor.pos.y ?? 0.5 + (hovered ? 0.3 : 0);
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    if (onInteract) {
      onInteract(actor);
    }
  };

  return (
    <group
      ref={groupRef}
      position={[actor.pos.x, actor.pos.y ?? 0.5, actor.pos.z]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Base do baú */}
      <mesh>
        <boxGeometry args={[1.2, 0.6, 0.8]} />
        <meshStandardMaterial
          color={config.color}
          metalness={0.4}
          roughness={0.6}
          emissive={hovered ? 0x4a2511 : 0x000000}
        />
      </mesh>

      {/* Tampa (lid) */}
      <group position={[0, 0.3, 0]}>
        <mesh ref={lidRef} position={[0, 0.1, 0]}>
          <boxGeometry args={[1.2, 0.2, 0.8]} />
          <meshStandardMaterial
            color={0xa0522d}
            metalness={0.3}
            roughness={0.7}
            emissive={hovered ? 0x663300 : 0x000000}
          />
        </mesh>
      </group>

      {/* Cintas metálicas decorativas */}
      <mesh position={[0, 0.15, -0.35]}>
        <boxGeometry args={[1.2, 0.08, 0.1]} />
        <meshStandardMaterial color={0xc0c0c0} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.15, 0.35]}>
        <boxGeometry args={[1.2, 0.08, 0.1]} />
        <meshStandardMaterial color={0xc0c0c0} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Puxador/fechadura */}
      <mesh position={[0, 0.15, 0.45]}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} />
        <meshStandardMaterial color={0xffd700} metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}