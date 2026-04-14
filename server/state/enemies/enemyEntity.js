// server/state/enemies/enemyEntity.js

/**
 * Converters para entidades de inimigos.
 * Padrão: compatível com movement/entity.js, mas para ENEMY.
 * 
 * ✨ CORRIGIDO: entityId agora usa prefixo "enemy_" para evitar conflito com playerIds
 */

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readHpCurrent(enemy) {
  return toNum(
    enemy?.hpCurrent ??
      enemy?.hp_current ??
      enemy?.hp ??
      enemy?.stats?.hpCurrent ??
      enemy?.stats?.hp_current,
    0
  );
}

function readHpMax(enemy) {
  return toNum(
    enemy?.hpMax ??
      enemy?.hp_max ??
      enemy?.stats?.hpMax ??
      enemy?.stats?.hp_max,
    0
  );
}

function bumpRev(enemy) {
  const cur = Number(enemy.rev ?? 0);
  enemy.rev = Number.isFinite(cur) ? cur + 1 : 1;
}

/**
 * ✨ CORRIGIDO: Converte enemy runtime para entity replicável (baseline/spawn).
 * 
 * ANTES (❌ BUG):
 * entityId: String(enemy.id),  // "1", "2" → conflita com playerIds!
 * 
 * AGORA (✅ CORRETO):
 * entityId: `enemy_${enemy.id}`,  // "enemy_1", "enemy_2" → nunca conflita!
 */
function toEntity(enemy) {
  const hpCurrent = readHpCurrent(enemy);
  const hpMax = readHpMax(enemy);

  return {
    entityId: `enemy_${enemy.id}`,  // ✨ PREFIXO ADICIONADO
    kind: "ENEMY",
    displayName: enemy.displayName ?? enemy.enemyDefName ?? enemy.enemyDefCode ?? "Enemy",
    visualKind: enemy.visualKind ?? "DEFAULT",
    assetKey: enemy.assetKey ?? null,
    visualScale: Number(enemy.visualScale ?? 1),
    pos: enemy.pos ?? { x: 0, z: 0 },
    yaw: Number(enemy.yaw ?? 0),
    hp: hpCurrent, // compat legado
    action: enemy.action ?? "idle",
    rev: Number(enemy.rev ?? 0),

    vitals: {
      hp: {
        current: hpCurrent,
        max: hpMax,
      },
    },
  };
}

/**
 * ✨ CORRIGIDO: Converte para delta (atualização incremental).
 */
function toDelta(enemy) {
  const hpCurrent = readHpCurrent(enemy);
  const hpMax = readHpMax(enemy);

  return {
    entityId: `enemy_${enemy.id}`,  // ✨ PREFIXO ADICIONADO
    kind: "ENEMY",
    displayName: enemy.displayName ?? enemy.enemyDefName ?? enemy.enemyDefCode ?? "Enemy",
    visualKind: enemy.visualKind ?? "DEFAULT",
    assetKey: enemy.assetKey ?? null,
    visualScale: Number(enemy.visualScale ?? 1),
    pos: enemy.pos ?? { x: 0, z: 0 },
    yaw: Number(enemy.yaw ?? 0),
    hp: hpCurrent, // compat legado
    action: enemy.action ?? "idle",
    rev: Number(enemy.rev ?? 0),

    vitals: {
      hp: {
        current: hpCurrent,
        max: hpMax,
      },
    },
  };
}

module.exports = {
  bumpRev,
  readHpCurrent,
  readHpMax,
  toEntity,
  toDelta,
};
