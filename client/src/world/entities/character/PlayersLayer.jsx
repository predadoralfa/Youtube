/**
 * PlayersLayer.jsx
 *
 * Renderiza entidades dinâmicas replicadas via multiplayer:
 * - Players (self e outros)
 * - Entidades que se movem/mudam estado
 *
 * Usa worldStoreRef para obter lista de entidades do interest set
 *
 * Props:
 * - worldStoreRef: referência ao store de entidades
 */
import { useMemo, useSyncExternalStore } from "react";
import { createPlayerMesh } from "./player";

export function PlayersLayer({ worldStoreRef }) {
  const store = worldStoreRef?.current;
  const subscribe = store?.subscribe ?? (() => () => {});
  const getVersionSnapshot = () => store?.version ?? 0;

  const version = useSyncExternalStore(subscribe, getVersionSnapshot, getVersionSnapshot);
  const entities = useMemo(() => store?.getSnapshot?.() ?? [], [store, version]);
  const selfId = store?.selfId ?? null;

  return (
    <group name="players-layer">
      {entities.map((entity) => {
        const entityId = String(entity.entityId);
        const isSelf = selfId && String(selfId) === entityId;

        return (
          <PlayerEntity
            key={entityId}
            entity={entity}
            isSelf={isSelf}
          />
        );
      })}
    </group>
  );
}

/**
 * PlayerEntity: renderiza um player individual
 */
function PlayerEntity({ entity, isSelf }) {
  const x = Number(entity?.pos?.x ?? 0);
  const y = Number(entity?.pos?.y ?? 0);
  const z = Number(entity?.pos?.z ?? 0);
  const yaw = Number(entity?.yaw ?? 0);
  const displayName = entity?.displayName ?? "Unknown";

  return (
    <group 
      position={[x, y, z]} 
      rotation={[0, yaw, 0]}
      name={`player-${entity.entityId}`}
    >
      {/* ✅ Mesh do player (cilindro colorido) */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.3, 1.8, 8]} />
        <meshStandardMaterial
          color={isSelf ? "#ff2d55" : "#2d7dff"}
          metalness={0.2}
          roughness={0.7}
        />
      </mesh>

      {/* ✅ Label com nome do player (opcional) */}
      <group position={[0, 1.2, 0]} scale={0.01}>
        <sprite name={`player-label-${entity.entityId}`}>
          <spriteMaterial sizeAttenuation={true} />
        </sprite>
      </group>
    </group>
  );
}
