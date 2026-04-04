// server/socket/handlers/world/baseline.js
// ✨ CORRIGIDO: Fix pos=(0, 0) bug

const { getRuntime } = require("../../../state/runtimeStore");
const { getUsersInChunks } = require("../../../state/presenceIndex");
const { toEntity } = require("./entity");
const { computeInterestFromRuntime } = require("./interest");

const { getEnemiesForInstance } = require("../../../state/enemies/enemiesRuntimeStore");
const { toEntity: enemyToEntity } = require("../../../state/enemies/enemyEntity");

function buildBaseline(rt) {
  const userId = String(rt.userId ?? rt.user_id ?? "?");
  const instanceId = String(rt.instanceId ?? rt.instance_id ?? "?");
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[BASELINE] 🔍 Construindo para userId=${userId} instanceId=${instanceId}`);
  console.log(`${'='.repeat(80)}`);

  const { cx, cz } = computeInterestFromRuntime(rt);
  console.log(`[BASELINE] Interest chunk: (${cx}, ${cz})`);

  const you = toEntity(rt);
  console.log(`[BASELINE] Self: ${you.entityId} pos=(${you.pos.x}, ${you.pos.z})`);

  const visibleUserIds = getUsersInChunks(rt.instanceId, cx, cz);
  console.log(`[BASELINE] Visible players in chunk: ${visibleUserIds.length}`);

  const others = [];

  for (const uid of visibleUserIds) {
    const other = getRuntime(uid);
    if (!other) {
      console.log(`[BASELINE] ⚠️ Player ${uid} não encontrado no runtime store`);
      continue;
    }

    if (other.connectionState === "OFFLINE") {
      console.log(`[BASELINE] ⏸️ Player ${uid} está OFFLINE`);
      continue;
    }

    const e = toEntity(other);
    if (e.entityId === you.entityId) {
      console.log(`[BASELINE] 🚫 Ignorando self (${you.entityId})`);
      continue;
    }
    
    console.log(`[BASELINE] ✅ Player: ${e.entityId} pos=(${e.pos.x}, ${e.pos.z})`);
    others.push(e);
  }

  console.log(`[BASELINE] 🔍 Buscando inimigos para instanceId=${instanceId}`);
  const enemies = getEnemiesForInstance(rt.instanceId);
  console.log(`[BASELINE] Total de inimigos no store: ${enemies.length}`);

  for (const enemy of enemies) {
    if (enemy.status === "ALIVE") {
      const enemyEntity = enemyToEntity(enemy);
      
      console.log(`[BASELINE] ✅ Enemy: ${enemyEntity.entityId} `
        + `displayName=${enemyEntity.displayName} `
        + `pos=(${enemyEntity.pos.x}, ${enemyEntity.pos.z}) `
        + `status=${enemy.status}`);
      
      others.push(enemyEntity);
    } else {
      console.log(`[BASELINE] ⏸️ Enemy ${enemy.id} status=${enemy.status} (ignorado)`);
    }
  }

  console.log(`[BASELINE] 📊 TOTAL others (players + enemies): ${others.length}`);

  // ✨ CORRIGIDO: Usar pos?.x, pos?.z para obter posição corretamente
  const runtimePayload = {
    userId: String(rt.userId ?? rt.user_id ?? ""),
    entityId: String(rt.entityId ?? rt.userId ?? rt.user_id ?? ""),
    instanceId: String(rt.instanceId ?? rt.instance_id ?? ""),
    pos_x: Number(rt.pos?.x ?? rt.pos_x ?? 0),
    pos_y: Number(rt.pos?.y ?? rt.pos_y ?? 0),
    pos_z: Number(rt.pos?.z ?? rt.pos_z ?? 0),
    yaw: Number(rt.yaw ?? 0),
    connectionState: String(rt.connectionState ?? "ONLINE"),
    vitals: rt.vitals ? {
      hp: {
        current: Number(rt.vitals.hp?.current ?? rt.hpCurrent ?? 0),
        max: Number(rt.vitals.hp?.max ?? rt.hpMax ?? 0),
      },
      stamina: {
        current: Number(rt.vitals.stamina?.current ?? rt.staminaCurrent ?? 0),
        max: Number(rt.vitals.stamina?.max ?? rt.staminaMax ?? 0),
      },
      hunger: {
        current: Number(rt.vitals.hunger?.current ?? rt.hungerCurrent ?? 0),
        max: Number(rt.vitals.hunger?.max ?? rt.hungerMax ?? 0),
      },
    } : undefined,
  };

  console.log(`[BASELINE] ✅ Runtime payload: userId=${runtimePayload.userId} pos=(${runtimePayload.pos_x}, ${runtimePayload.pos_z})`);
  console.log(`${'='.repeat(80)}\n`);

  return {
    instanceId: String(rt.instanceId),
    runtime: runtimePayload,
    you,
    chunk: { cx, cz },
    others,
  };
}

module.exports = {
  buildBaseline,
};
