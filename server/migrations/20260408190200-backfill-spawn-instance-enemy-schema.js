"use strict";

function keyOf(spawnInstanceId, spawnDefComponentId) {
  return `${Number(spawnInstanceId)}:${Number(spawnDefComponentId)}`;
}

function normalizeSlotStatus(componentStatus, runtimeStatus) {
  if (String(componentStatus).toUpperCase() !== "ACTIVE") {
    return "DISABLED";
  }

  if (String(runtimeStatus).toUpperCase() === "ALIVE") {
    return "ALIVE";
  }

  if (String(runtimeStatus).toUpperCase() === "DISABLED") {
    return "DISABLED";
  }

  return "DEAD";
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sequelize = queryInterface.sequelize;

    const [components] = await sequelize.query(`
      SELECT
        sdc.id,
        sdc.spawn_def_id,
        sdc.enemy_def_id,
        sdc.status,
        sdc.quantity,
        sdc.sort_order,
        sdc.created_at,
        sdc.updated_at
      FROM ga_spawn_def_component sdc
      ORDER BY sdc.id ASC
    `);

    if (components.length > 0) {
      await queryInterface.bulkInsert(
        "ga_spawn_def_enemy",
        components.map((row) => ({
          id: Number(row.id),
          spawn_def_id: Number(row.spawn_def_id),
          enemy_def_id: Number(row.enemy_def_id),
          status: row.status,
          quantity: Number(row.quantity ?? 1),
          sort_order: Number(row.sort_order ?? 0),
          created_at: row.created_at ?? now,
          updated_at: row.updated_at ?? now,
        }))
      );
    }

    const [spawnInstances] = await sequelize.query(`
      SELECT
        si.id,
        si.spawn_def_id
      FROM ga_spawn_instance si
      ORDER BY si.id ASC
    `);

    const [runtimeRows] = await sequelize.query(`
      SELECT
        er.id,
        er.spawn_instance_id,
        er.spawn_def_component_id,
        er.status,
        er.dead_at,
        er.respawn_at,
        er.created_at,
        er.updated_at,
        COALESCE(ers.hp_current, eds.hp_max, 1) AS hp_current
      FROM ga_enemy_runtime er
      LEFT JOIN ga_enemy_runtime_stats ers
        ON ers.enemy_runtime_id = er.id
      LEFT JOIN ga_spawn_def_component sdc
        ON sdc.id = er.spawn_def_component_id
      LEFT JOIN ga_enemy_def_stats eds
        ON eds.enemy_def_id = sdc.enemy_def_id
      ORDER BY er.spawn_instance_id ASC, er.spawn_def_component_id ASC, er.id ASC
    `);

    const [hpRows] = await sequelize.query(`
      SELECT
        sdc.id,
        COALESCE(eds.hp_max, 1) AS hp_max
      FROM ga_spawn_def_component sdc
      LEFT JOIN ga_enemy_def_stats eds
        ON eds.enemy_def_id = sdc.enemy_def_id
    `);

    const hpByComponentId = new Map(
      hpRows.map((row) => [Number(row.id), Number(row.hp_max ?? 1)])
    );

    const runtimeByKey = new Map();
    let nextId = 1;
    for (const row of runtimeRows) {
      const runtimeId = Number(row.id);
      if (runtimeId >= nextId) nextId = runtimeId + 1;

      const key = keyOf(row.spawn_instance_id, row.spawn_def_component_id);
      if (!runtimeByKey.has(key)) runtimeByKey.set(key, []);
      runtimeByKey.get(key).push(row);
    }

    const componentsBySpawnDefId = new Map();
    for (const component of components) {
      const spawnDefId = Number(component.spawn_def_id);
      if (!componentsBySpawnDefId.has(spawnDefId)) {
        componentsBySpawnDefId.set(spawnDefId, []);
      }
      componentsBySpawnDefId.get(spawnDefId).push(component);
    }

    const instanceEnemyRows = [];

    for (const spawnInstance of spawnInstances) {
      const spawnDefId = Number(spawnInstance.spawn_def_id);
      const spawnInstanceId = Number(spawnInstance.id);
      const defEnemies = componentsBySpawnDefId.get(spawnDefId) ?? [];

      for (const defEnemy of defEnemies) {
        const spawnDefEnemyId = Number(defEnemy.id);
        const desiredQty = Math.max(0, Number(defEnemy.quantity ?? 0));
        const matchedRuntimes =
          runtimeByKey.get(keyOf(spawnInstanceId, spawnDefEnemyId)) ?? [];
        const hpMax = Number(hpByComponentId.get(spawnDefEnemyId) ?? 1);

        for (let slotIndex = 0; slotIndex < desiredQty; slotIndex += 1) {
          const matched = matchedRuntimes[slotIndex] ?? null;
          const rowId = matched ? Number(matched.id) : nextId++;
          const slotStatus = normalizeSlotStatus(defEnemy.status, matched?.status ?? "ALIVE");

          instanceEnemyRows.push({
            id: rowId,
            spawn_instance_id: spawnInstanceId,
            spawn_def_enemy_id: spawnDefEnemyId,
            slot_index: slotIndex,
            status: slotStatus,
            hp_current:
              slotStatus === "ALIVE"
                ? Number(matched?.hp_current ?? hpMax)
                : Math.max(0, Number(matched?.hp_current ?? 0)),
            dead_at: slotStatus === "DEAD" ? matched?.dead_at ?? null : null,
            respawn_at: slotStatus === "DEAD" ? matched?.respawn_at ?? null : null,
            created_at: matched?.created_at ?? now,
            updated_at: matched?.updated_at ?? now,
          });
        }
      }
    }

    if (instanceEnemyRows.length > 0) {
      await queryInterface.bulkInsert("ga_spawn_instance_enemy", instanceEnemyRows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("ga_spawn_instance_enemy", null, {});
    await queryInterface.bulkDelete("ga_spawn_def_enemy", null, {});
  },
};
