/**
 * EnemiesLayer.jsx
 *
 * Renderiza inimigos replicados via multiplayer.
 * Padrão idêntico a PlayersLayer.jsx
 *
 * Usa worldStoreRef para obter lista de entidades do interesse
 *
 * Props:
 * - worldStoreRef: referência ao store de entidades
 */
import { useMemo } from "react";

export function EnemiesLayer({ worldStoreRef }) {
  const store = worldStoreRef?.current;
  
  const entities = useMemo(() => {
    return store?.getSnapshot?.() ?? [];
  }, [store]);

  console.log("[ENEMIES_LAYER] entities total:", entities.length);
  console.log("[ENEMIES_LAYER] first 3:", entities.slice(0, 3));

  const selfId = useMemo(() => store?.selfId ?? null, [store]);

  // Filtra só inimigos (exclui self e players)
  // Inimigos têm IDs numéricos, players têm IDs de usuário
  const enemies = useMemo(() => {
    return entities.filter((entity) => {
      // Exclui self
      if (selfId && String(selfId) === String(entity.entityId)) {
        return false;
      }
      // Simplificado: incluir tudo que não é self
      // Você pode adicionar lógica de tipo depois se quiser ser específico
      return true;
    });
  }, [entities, selfId]);

  return (
    <group name="enemies-layer">
      {enemies.map((entity) => {
        const entityId = String(entity.entityId);
        return (
          <EnemyEntity
            key={entityId}
            entity={entity}
          />
        );
      })}
    </group>
  );
}

/**
 * EnemyEntity: renderiza um inimigo individual
 */
function EnemyEntity({ entity }) {
  const x = Number(entity?.pos?.x ?? 0);
  const z = Number(entity?.pos?.z ?? 0);
  const yaw = Number(entity?.yaw ?? 0);
  const displayName = entity?.displayName ?? "Enemy";

  // Cores por tipo de inimigo
  const getColor = () => {
    const name = String(displayName || "").toUpperCase();
    
    if (name.includes("RABBIT")) return "#ff6b35"; // Laranja
    if (name.includes("GOBLIN")) return "#4ade80"; // Verde
    if (name.includes("WOLF")) return "#ef4444";   // Vermelho
    
    return "#94a3b8"; // Cinza padrão
  };

  return (
    <group
      position={[x, 0.5, z]}
      rotation={[0, yaw, 0]}
      name={`enemy-${entity.entityId}`}
    >
      {/* Esfera colorida do inimigo */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={getColor()}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>

      {/* Label com nome do inimigo (opcional) */}
      <group position={[0, 1.0, 0]} scale={0.01}>
        <sprite name={`enemy-label-${entity.entityId}`}>
          <spriteMaterial sizeAttenuation={true} />
        </sprite>
      </group>
    </group>
  );
}