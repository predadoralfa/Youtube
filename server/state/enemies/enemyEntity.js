// server/state/enemies/enemyEntity.js

/**
 * Converters para entidades de inimigos.
 * Padrão: mesma estrutura de movement/entity.js, mas para inimigos.
 */

function bumpRev(enemy) {
    const cur = Number(enemy.rev ?? 0);
    enemy.rev = Number.isFinite(cur) ? cur + 1 : 1;
  }
  
  /**
   * Converte enemy runtime para entity replicável (baseline/spawn).
   * Padrão compatível com entitiesStore do client.
   */
  function toEntity(enemy) {
    return {
      entityId: String(enemy.id),
      displayName: enemy.enemyDefCode ?? "Enemy",
      pos: enemy.pos ?? { x: 0, z: 0 },
      yaw: Number(enemy.yaw ?? 0),
      hp: Number(enemy.stats?.hpCurrent ?? 0),
      action: enemy.action ?? "idle",
      rev: Number(enemy.rev ?? 0),
    };
  }
  
  /**
   * Converte para delta (atualização incremental).
   * Reduz payload (só campos que mudam).
   */
  function toDelta(enemy) {
    return {
      entityId: String(enemy.id),
      pos: enemy.pos ?? { x: 0, z: 0 },
      yaw: Number(enemy.yaw ?? 0),
      hp: Number(enemy.stats?.hpCurrent ?? 0),
      action: enemy.action ?? "idle",
      rev: Number(enemy.rev ?? 0),
    };
  }
  
  module.exports = {
    bumpRev,
    toEntity,
    toDelta,
  };