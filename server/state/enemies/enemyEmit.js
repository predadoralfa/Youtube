// server/state/enemies/enemyEmit.js
// ✨ COM LOGS EXTENSOS PARA DEBUG

const { toEntity, toDelta } = require("./enemyEntity");

/**
 * ✨ CORRIGIDO: Emite delta de inimigo para ROOM GERAL DE INSTÂNCIA
 * (em vez de rooms de chunk específicas)
 * 
 * Razão: Enquanto o mapa é menor que um chunk, todos os players
 * estão na mesma sala e recebem todos os deltas.
 * 
 * TODO: Quando tiver múltiplos chunks, voltar para sistema de interesse
 * baseado em chunks.
 */
function emitEnemyDelta(io, enemy) {
  if (!io || !enemy) {
    console.warn(`[EMIT_DELTA] ⚠️ io=${!!io} enemy=${!!enemy}`);
    return;
  }

  const delta = toDelta(enemy);

  // ✨ CORRIGIDO: Emitir para room geral da instância
  const roomId = `inst:${enemy.instanceId}`;
  
  
  io.to(roomId).emit("entity:delta", delta);
}

/**
 * Emite spawn/baseline de inimigo quando aparece para um player.
 * Usa o serializer central para manter contrato consistente com baseline/delta.
 * 
 * ✨ TAMBÉM CORRIGIDO: Room geral da instância
 */
function emitEnemySpawn(io, enemy) {
  if (!io || !enemy) {
    console.warn(`[EMIT_SPAWN] ⚠️ io=${!!io} enemy=${!!enemy}`);
    return;
  }

  const entity = toEntity(enemy);

  // ✨ CORRIGIDO: Emitir para room geral da instância
  const roomId = `inst:${enemy.instanceId}`;
  
  console.log(`[EMIT_SPAWN] 📤 Enemy spawn: id=${enemy.id} displayName=${enemy.displayName} room=${roomId} pos=(${entity.pos.x}, ${entity.pos.z})`);
  
  io.to(roomId).emit("entity:spawn", entity);
  
  console.log(`[EMIT_SPAWN] ✅ Emitido para room: ${roomId}`);
}

/**
 * Emite despawn de inimigo.
 * 
 * ✨ TAMBÉM CORRIGIDO: Room geral da instância
 */
function emitEnemyDespawn(io, enemy) {
  if (!io || !enemy) {
    console.warn(`[EMIT_DESPAWN] ⚠️ io=${!!io} enemy=${!!enemy}`);
    return;
  }

  // ✨ CORRIGIDO: Emitir para room geral da instância
  const roomId = `inst:${enemy.instanceId}`;
  
  console.log(`[EMIT_DESPAWN] 📤 Enemy despawn: id=${enemy.id} displayName=${enemy.displayName} room=${roomId}`);
  
  io.to(roomId).emit("entity:despawn", {
    entityId: String(enemy.id),
    kind: "ENEMY",
    rev: Number(enemy.rev ?? 0),
  });
  
  console.log(`[EMIT_DESPAWN] ✅ Emitido para room: ${roomId}`);
}

module.exports = {
  emitEnemyDelta,
  emitEnemySpawn,
  emitEnemyDespawn,
};