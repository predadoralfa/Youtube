/**
 * DefaultActor.jsx
 * 
 * Renderização genérica de um actor com um cubo
 * Serve como fallback para actorTypes não mapeados especificamente
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { getActorConfig } from "./ActorMappings";

export function DefaultActor({ actor, onInteract }) {
  const meshRef = useRef();
  const config = getActorConfig(actor.actorType);

  // Rotação suave para efeito visual
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (onInteract) {
      onInteract(actor);
    }
  };

  return (
    <group position={[actor.pos.x, actor.pos.y ?? 0.5, actor.pos.z]}>
      {/* Cubo principal */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={(e) => {
          if (e.object.material) {
            e.object.material.emissive.setHex(0x444444);
          }
        }}
        onPointerOut={(e) => {
          if (e.object.material) {
            e.object.material.emissive.setHex(0x000000);
          }
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={config.color}
          metalness={0.3}
          roughness={0.7}
          emissive={0x000000}
        />
      </mesh>

      {/* Label acima do ator */}
      <group position={[0, 0.8, 0]}>
        <sprite>
          <spriteMaterial map={null} />
        </sprite>
      </group>
    </group>
  );
}