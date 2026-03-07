// server/socket/handlers/world/baseline.js
// ATUALIZADO: Inclui inimigos no baseline

const { getRuntime } = require("../../../state/runtimeStore");
const { getUsersInChunks } = require("../../../state/presenceIndex");
const { toEntity } = require("./entity");
const { computeInterestFromRuntime } = require("./interest");

// ✨ NOVO: incluir inimigos do store
const { getEnemiesForInstance } = require("../../../state/enemies/enemiesRuntimeStore");
const { toEntity: enemyToEntity } = require("../../../state/enemies/enemyEntity");

/**
 * Baseline autoritativo "amigável pro front":
 * - you: entidade completa do self
 * - others: lista sem self (players + inimigos)
 * 
 * ✨ ATUALIZADO: Inclui inimigos visíveis no baseline
 */
function buildBaseline(rt) {
  const { cx, cz } = computeInterestFromRuntime(rt);

  const you = toEntity(rt);

  const visibleUserIds = getUsersInChunks(rt.instanceId, cx, cz);

  const others = [];

  // Adiciona players visíveis
  for (const uid of visibleUserIds) {
    const other = getRuntime(uid);
    if (!other) continue;

    if (other.connectionState === "OFFLINE") continue;

    const e = toEntity(other);
    if (e.entityId === you.entityId) continue;
    others.push(e);
  }

  // ✨ NOVO: Adiciona inimigos vivos do mesmo chunk
  const enemies = getEnemiesForInstance(rt.instanceId);
  for (const enemy of enemies) {
    // Filtra apenas inimigos no interesse do player (mesmo chunk)
    // Simplificado: incluir todos os vivos (você pode otimizar com chunk later)
    if (enemy.status === "ALIVE") {
      const enemyEntity = enemyToEntity(enemy);
      others.push(enemyEntity);
    }
  }

  return {
    instanceId: String(rt.instanceId),
    you,
    chunk: { cx, cz },
    others,
  };
}

module.exports = {
  buildBaseline,
};