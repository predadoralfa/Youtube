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
  
  const { cx, cz } = computeInterestFromRuntime(rt);

  const you = toEntity(rt);

  const visibleUserIds = getUsersInChunks(rt.instanceId, cx, cz);

  const others = [];

  for (const uid of visibleUserIds) {
    const other = getRuntime(uid);
    if (!other) {
      continue;
    }

    if (other.connectionState === "OFFLINE") {
      continue;
    }

    const e = toEntity(other);
    if (e.entityId === you.entityId) {
      continue;
    }

    others.push(e);
  }

  const enemies = getEnemiesForInstance(rt.instanceId);

  for (const enemy of enemies) {
    if (enemy.status === "ALIVE") {
      const enemyEntity = enemyToEntity(enemy);

      others.push(enemyEntity);
    }
  }

  const runtimePayload = {
    userId: String(rt.userId ?? rt.user_id ?? ""),
    entityId: String(rt.entityId ?? rt.userId ?? rt.user_id ?? ""),
    instanceId: String(rt.instanceId ?? rt.instance_id ?? ""),
    rev: Number(rt.rev ?? 0),
    speed: rt.speed ?? null,
    pos_x: Number(rt.pos?.x ?? rt.pos_x ?? 0),
    pos_y: Number(rt.pos?.y ?? rt.pos_y ?? 0),
    pos_z: Number(rt.pos?.z ?? rt.pos_z ?? 0),
    yaw: Number(rt.yaw ?? 0),
    cameraPitch: Number(rt.cameraPitch ?? rt.camera_pitch ?? Math.PI / 4),
    cameraDistance: Number(rt.cameraDistance ?? rt.camera_distance ?? 26),
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
      thirst: {
        current: Number(rt.vitals.thirst?.current ?? rt.thirstCurrent ?? 0),
        max: Number(rt.vitals.thirst?.max ?? rt.thirstMax ?? 0),
      },
    } : undefined,
    status: rt.status
      ? {
          immunity: {
            current: Number(rt.status.immunity?.current ?? rt.immunityCurrent ?? 0),
            max: Number(rt.status.immunity?.max ?? rt.immunityMax ?? 0),
            percent: Number(rt.status.immunity?.percent ?? rt.immunityPercent ?? 0),
          },
      fever: {
        current: Number(rt.status.fever?.current ?? rt.diseaseLevel ?? 0),
        max: 100,
        percent: Number(rt.status.fever?.percent ?? rt.diseasePercent ?? Math.round((Math.min(Number(rt.status.fever?.current ?? rt.diseaseLevel ?? 0), 100) / 100) * 100000) / 1000),
        severity: Number(rt.status.fever?.severity ?? rt.diseaseSeverity ?? 0),
        active: Number(rt.status.fever?.current ?? rt.diseaseLevel ?? 0) > 0,
      },
          debuffs: rt.status.debuffs ?? null,
          sleep: {
            current: Number(rt.status.sleep?.current ?? rt.sleepCurrent ?? 0),
            max: Number(rt.status.sleep?.max ?? rt.sleepMax ?? 0),
          },
        }
      : undefined,
  };

  console.log(
    `[BASELINE_POS] user=${String(rt.userId)} ` +
      `you=(${Number(you?.pos?.x ?? NaN)}, ${Number(you?.pos?.z ?? NaN)}) ` +
      `runtime=(${Number(runtimePayload?.pos_x ?? NaN)}, ${Number(runtimePayload?.pos_z ?? NaN)}) ` +
      `instance=${String(rt.instanceId ?? rt.instance_id ?? "?")} ` +
      `rev=${Number(rt.rev ?? 0)}`
  );

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
