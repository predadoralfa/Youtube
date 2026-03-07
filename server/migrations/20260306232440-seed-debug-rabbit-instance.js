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
        throw new Error("WILD_RABBIT não encontrado.");
      }

      const [spawnRows] = await queryInterface.sequelize.query(
        `
        SELECT id, pos_x, pos_z
        FROM ga_spawn_point
        WHERE instance_id = 1
        ORDER BY id ASC
        LIMIT 1
        `,
        { transaction }
      );

      const spawnPoint = spawnRows?.[0];

      if (!spawnPoint) {
        throw new Error("spawn_point não encontrado.");
      }

      const [entryRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_spawn_entry
        WHERE spawn_point_id = :spawnPointId
        ORDER BY id ASC
        LIMIT 1
        `,
        {
          replacements: { spawnPointId: spawnPoint.id },
          transaction,
        }
      );

      const spawnEntryId = entryRows?.[0]?.id;

      if (!spawnEntryId) {
        throw new Error("spawn_entry não encontrado.");
      }

      const posX = Number(spawnPoint.pos_x);
      const posZ = Number(spawnPoint.pos_z);

      await queryInterface.bulkInsert(
        "ga_enemy_instance",
        [
          {
            spawn_point_id: spawnPoint.id,
            spawn_entry_id: spawnEntryId,
            enemy_def_id: enemyDefId,
            status: "ALIVE",
            pos_x: posX,
            pos_z: posZ,
            yaw: 0,
            home_x: posX,
            home_z: posZ,
            spawned_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );

      const [instanceRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_enemy_instance
        WHERE spawn_point_id = :spawnPointId
          AND spawn_entry_id = :spawnEntryId
          AND enemy_def_id = :enemyDefId
        ORDER BY id DESC
        LIMIT 1
        `,
        {
          replacements: {
            spawnPointId: spawnPoint.id,
            spawnEntryId,
            enemyDefId,
          },
          transaction,
        }
      );

      const enemyInstanceId = instanceRows?.[0]?.id;

      if (!enemyInstanceId) {
        throw new Error("Não foi possível localizar ga_enemy_instance criada.");
      }

      await queryInterface.bulkInsert(
        "ga_enemy_instance_stats",
        [
          {
            enemy_instance_id: enemyInstanceId,
            hp_current: 10,
            hp_max: 10,
            move_speed: 1.2,
            attack_speed: 0.3,
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

      if (!enemyDefId) return;

      const [instanceRows] = await queryInterface.sequelize.query(
        `
        SELECT ei.id
        FROM ga_enemy_instance ei
        WHERE ei.enemy_def_id = :enemyDefId
        ORDER BY ei.id DESC
        LIMIT 1
        `,
        {
          replacements: { enemyDefId },
          transaction,
        }
      );

      const enemyInstanceId = instanceRows?.[0]?.id;

      if (!enemyInstanceId) return;

      await queryInterface.bulkDelete(
        "ga_enemy_instance_stats",
        { enemy_instance_id: enemyInstanceId },
        { transaction }
      );

      await queryInterface.bulkDelete(
        "ga_enemy_instance",
        { id: enemyInstanceId },
        { transaction }
      );
    });
  },
};