/**
 * PrimitiveShelterActor.jsx
 *
 * Renderização do Primitive Shelter usando o asset 3D real.
 */
import { useMemo } from "react";
import { useGLTF, Text } from "@react-three/drei";
import { getActorConfig } from "./ActorMappings";

const primitiveShelterModelUrl = new URL("../../../assets/Primitive Shelter.glb", import.meta.url).href;

export function PrimitiveShelterActor({ actor, onInteract }) {
  const config = getActorConfig(actor?.actorType ?? "PRIMITIVE_SHELTER");
  const displayName = String(actor?.displayName ?? "Primitive Shelter").trim() || "Primitive Shelter";
  const ownerName =
    String(actor?.state?.ownerName ?? actor?.state?.owner_name ?? "Unknown").trim() || "Unknown";
  const constructionState = String(actor?.state?.constructionState ?? "PLANNED").trim().toUpperCase();
  const durationMs = Math.max(1, Number(actor?.state?.constructionDurationMs ?? 180000));
  const startedAtMs = Number(actor?.state?.constructionStartedAtMs ?? 0);
  const progressMs =
    constructionState === "RUNNING" && Number.isFinite(startedAtMs) && startedAtMs > 0
      ? Math.max(0, Math.min(durationMs, Date.now() - startedAtMs))
      : Math.max(0, Number(actor?.state?.constructionProgressMs ?? 0));
  const progressPct = Math.max(0, Math.min(100, Math.round((progressMs / durationMs) * 100)));
  const statusLabel =
    constructionState === "RUNNING"
      ? `Building ${progressPct}%`
      : constructionState === "COMPLETED"
        ? "Completed"
        : "Planned";
  const lineColor =
    constructionState === "COMPLETED" ? 0x4ade80 : constructionState === "RUNNING" ? 0xfbbf24 : 0xffffff;

  const { scene } = useGLTF(primitiveShelterModelUrl);
  const model = useMemo(() => scene.clone(true), [scene]);

  const handleInteract = (e) => {
    e.stopPropagation();
    onInteract?.(actor);
  };

  return (
    <group position={[actor.pos.x, actor.pos.y ?? 0, actor.pos.z]} onClick={handleInteract} onContextMenu={handleInteract}>
      <primitive object={model} position={[0, 0, 0]} scale={1.35} rotation={[0, 0, 0]} />

      <Text
        position={[0, 1.7, 0]}
        fontSize={0.18}
        color={0xfef3c7}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.006}
        outlineColor={0x000000}
      >
        {displayName}
      </Text>
      <Text
        position={[0, 1.45, 0]}
        fontSize={0.12}
        color={0xf8fafc}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.004}
        outlineColor={0x000000}
      >
        {`Owner: ${ownerName}`}
      </Text>
      <Text
        position={[0, 1.25, 0]}
        fontSize={0.1}
        color={constructionState === "RUNNING" ? 0xfbbf24 : constructionState === "COMPLETED" ? 0x4ade80 : 0xfde68a}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.004}
        outlineColor={0x000000}
      >
        {statusLabel}
      </Text>

      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.12, 6]} />
        <meshStandardMaterial color={config.color} roughness={0.7} metalness={0.1} />
      </mesh>
    </group>
  );
}

useGLTF.preload(primitiveShelterModelUrl);
