/**
 * TwigActor.jsx
 *
 * Renderiza um recurso de galho no chão usando o asset Twig.glb.
 */
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";

const twigModelUrl = new URL("../../../assets/Twig.glb", import.meta.url).href;

export function TwigActor({ actor, onInteract }) {
  const { scene } = useGLTF(twigModelUrl);
  const model = useMemo(() => scene.clone(true), [scene]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onInteract) {
      onInteract(actor);
    }
  };

  return (
    <group
      position={[actor.pos.x, actor.pos.y ?? 0, actor.pos.z]}
      onClick={handleClick}
    >
      <primitive
        object={model}
        scale={7.5}
        rotation={[Math.PI / 2, 0.15, Math.PI / 2]}
      />
    </group>
  );
}

useGLTF.preload(twigModelUrl);
