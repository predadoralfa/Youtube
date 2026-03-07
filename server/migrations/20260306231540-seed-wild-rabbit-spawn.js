"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [enemyRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_enemy_def
        WHERE code = 'WILD_RABBIT'
        LIMIT 1
        `,
        { transaction }
      );

      const enemyDefId = enemyRows?.[0]?.id;

      if (!enemyDefId) {
        throw new Error(
          "Não encontrei ga_enemy_def com code = 'WILD_RABBIT'. Rode primeiro a seed do inimigo."
        );
      }

      await queryInterface.bulkInsert(
        "ga_spawn_point",
        [
          {
            instance_id: 1,
            status: "ACTIVE",
            spawn_kind: "ENEMY",
            shape_kind: "CIRCLE",
            pos_x: 120,
            pos_z: 80,
            radius: 15,
            max_alive: 4,
            respawn_ms: 20000,
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );

      const [spawnRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_spawn_point
        WHERE instance_id = 1
          AND status = 'ACTIVE'
          AND spawn_kind = 'ENEMY'
          AND shape_kind = 'CIRCLE'
          AND pos_x = 120
          AND pos_z = 80
          AND radius = 15
          AND max_alive = 4
          AND respawn_ms = 20000
        ORDER BY id DESC
        LIMIT 1
        `,
        { transaction }
      );

      const spawnPointId = spawnRows?.[0]?.id;

      if (!spawnPointId) {
        throw new Error(
          "Não foi possível localizar o ga_spawn_point criado para o WILD_RABBIT."
        );
      }

      await queryInterface.bulkInsert(
        "ga_spawn_entry",
        [
          {
            spawn_point_id: spawnPointId,
            enemy_def_id: enemyDefId,
            status: "ACTIVE",
            weight: 1,
            quantity_min: 1,
            quantity_max: 2,
            alive_limit: null,
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [enemyRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_enemy_def
        WHERE code = 'WILD_RABBIT'
        LIMIT 1
        `,
        { transaction }
      );

      const enemyDefId = enemyRows?.[0]?.id;

      const [spawnRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_spawn_point
        WHERE instance_id = 1
          AND status = 'ACTIVE'
          AND spawn_kind = 'ENEMY'
          AND shape_kind = 'CIRCLE'
          AND pos_x = 120
          AND pos_z = 80
          AND radius = 15
          AND max_alive = 4
          AND respawn_ms = 20000
        `,
        { transaction }
      );

      const spawnPointIds = spawnRows.map((row) => row.id);

      if (spawnPointIds.length > 0) {
        await queryInterface.bulkDelete(
          "ga_spawn_entry",
          {
            spawn_point_id: spawnPointIds,
            ...(enemyDefId ? { enemy_def_id: enemyDefId } : {}),
          },
          { transaction }
        );

        await queryInterface.bulkDelete(
          "ga_spawn_point",
          {
            id: spawnPointIds,
          },
          { transaction }
        );
      }
    });
  },
};