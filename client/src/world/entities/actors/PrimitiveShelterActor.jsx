import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { getActorConfig } from "./ActorMappings";

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

  const lineGeometry = useMemo(() => {
    const width = 2.6;
    const depth = 1.5;
    const y = 0.03;
    const hw = width / 2;
    const hd = depth / 2;
    const points = [
      new THREE.Vector3(-hw, y, -hd),
      new THREE.Vector3(hw, y, -hd),
      new THREE.Vector3(hw, y, hd),
      new THREE.Vector3(-hw, y, hd),
      new THREE.Vector3(-hw, y, -hd),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  const handleInteract = (e) => {
    e.stopPropagation();
    onInteract?.(actor);
  };

  return (
    <group position={[actor.pos.x, actor.pos.y ?? 0, actor.pos.z]}>
      <line geometry={lineGeometry} onClick={handleInteract} onContextMenu={handleInteract}>
        <lineBasicMaterial color={lineColor} transparent opacity={0.95} linewidth={2} />
      </line>

      <mesh position={[0, 0.02, 0]} onClick={handleInteract} onContextMenu={handleInteract}>
        <planeGeometry args={[2.2, 1.1]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.08} depthWrite={false} />
      </mesh>

      <Text
        position={[0, 0.45, 0]}
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
        position={[0, 0.2, 0]}
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
        position={[0, 0.04, 0]}
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
