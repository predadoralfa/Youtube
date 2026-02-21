// server/socket/handlers/world/baseline.js

const { getRuntime } = require("../../../state/runtimeStore");
const { getUsersInChunks } = require("../../../state/presenceIndex");
const { toEntity } = require("./entity");
const { computeInterestFromRuntime } = require("./interest");

/**
 * Baseline autoritativo "amigável pro front":
 * - you: entidade completa do self
 * - others: lista sem self
 */
function buildBaseline(rt) {
  const { cx, cz } = computeInterestFromRuntime(rt);

  const you = toEntity(rt);

  const visibleUserIds = getUsersInChunks(rt.instanceId, cx, cz);

  const others = [];
  for (const uid of visibleUserIds) {
    const other = getRuntime(uid);
    if (!other) continue;

    if (other.connectionState === "OFFLINE") continue;

    const e = toEntity(other);
    if (e.entityId === you.entityId) continue;
    others.push(e);
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