/**
 * HerbsActor.jsx
 *
 * Renderiza um actor de ervas usando o asset Herbs.glb.
 */
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";

const herbsModelUrl = new URL("../../../assets/Herbs.glb", import.meta.url).href;

export function HerbsActor({ actor, onInteract }) {
  const { scene } = useGLTF(herbsModelUrl);
  const model = useMemo(() => scene.clone(true), [scene]);

  const handleClick = (e) => {
    e.stopPropagation();
    onInteract?.(actor);
  };

  return (
    <group position={[actor.pos.x, actor.pos.y ?? 0, actor.pos.z]} onClick={handleClick} onContextMenu={handleClick}>
      <primitive
        object={model}
        scale={6.5}
        rotation={[0, 0.15, 0]}
      />
    </group>
  );
}

useGLTF.preload(herbsModelUrl);
