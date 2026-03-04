/**
 * NPCActor.jsx
 * 
 * Renderização de um NPC (Non-Player Character)
 * Interativo: clique abre diálogo/quest
 */
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { getActorConfig } from "./ActorMappings";

export function NPCActor({ actor, onInteract }) {
  const groupRef = useRef();
  const headRef = useRef();
  const [hovered, setHovered] = useState(false);
  const config = getActorConfig("NPC");

  // Movimento suave da cabeça
  useFrame(({ clock }) => {
    if (headRef.current) {
      const t = clock.elapsedTime;
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.3;
      headRef.current.rotation.x = Math.cos(t * 0.6) * 0.1;
    }

    if (groupRef.current && hovered) {
      groupRef.current.position.y = actor.pos.y ?? 1 + Math.sin(clock.elapsedTime * 3) * 0.1;
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (onInteract) {
      onInteract(actor);
    }
  };

  return (
    <group
      ref={groupRef}
      position={[actor.pos.x, actor.pos.y ?? 1, actor.pos.z]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Corpo */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 1, 0.4]} />
        <meshStandardMaterial
          color={0x4169e1}
          metalness={0.2}
          roughness={0.7}
          emissive={hovered ? 0x2c4aa5 : 0x000000}
        />
      </mesh>

      {/* Cabeça */}
      <mesh ref={headRef} position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={0xf4a460}
          metalness={0.1}
          roughness={0.8}
          emissive={hovered ? 0xcd7f32 : 0x000000}
        />
      </mesh>

      {/* Olhos */}
      <mesh position={[-0.1, 0.8, 0.28]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={0x000000} />
      </mesh>
      <mesh position={[0.1, 0.8, 0.28]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={0x000000} />
      </mesh>

      {/* Braços esquerdo */}
      <mesh position={[-0.4, 0.3, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={0xf4a460} metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Braço direito */}
      <mesh position={[0.4, 0.3, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={0xf4a460} metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Pernas */}
      <mesh position={[-0.15, -0.3, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={0x2c2c2c} metalness={0} roughness={0.9} />
      </mesh>
      <mesh position={[0.15, -0.3, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={0x2c2c2c} metalness={0} roughness={0.9} />
      </mesh>

      {/* Indicador de interatividade (aura) */}
      {hovered && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial
            color={config.color}
            transparent={true}
            opacity={0.2}
            wireframe={false}
          />
        </mesh>
      )}
    </group>
  );
}