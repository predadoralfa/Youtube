/**
 * RiverActor.jsx
 *
 * Renderiza uma fonte de agua no mapa.
 */
import { useMemo } from "react";

export function RiverActor({ actor, onInteract }) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (onInteract) {
      onInteract(actor);
    }
  };

  const waterMaterial = useMemo(
    () => ({
      color: 0x1d8fe3,
      roughness: 0.2,
      metalness: 0.05,
      transparent: true,
      opacity: 0.72,
      side: 2,
    }),
    []
  );

  const foamMaterial = useMemo(
    () => ({
      color: 0x7fd9ff,
      roughness: 0.15,
      metalness: 0.02,
      transparent: true,
      opacity: 0.38,
      side: 2,
    }),
    []
  );

  return (
    <group position={[actor.pos.x, actor.pos.y ?? 0, actor.pos.z]} onClick={handleClick}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.5, 2.4, 1, 1]} />
        <meshStandardMaterial {...waterMaterial} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.1, 2.0, 1, 1]} />
        <meshStandardMaterial {...foamMaterial} />
      </mesh>
    </group>
  );
}
