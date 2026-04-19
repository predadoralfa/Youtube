"use strict";

const TREE_POS = { x: 40, y: 0, z: 14 };

async function findSingleId(queryInterface, transaction, sql, replacements = {}) {
  const [rows] = await queryInterface.sequelize.query(sql, { transaction, replacements });
  return Number(rows?.[0]?.id ?? 0) || null;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const treeAppleDefId = await findSingleId(
        queryInterface,
        transaction,
        `
        SELECT id
        FROM ga_actor_def
        WHERE code = 'TREE_APPLE'
        LIMIT 1
        `
      );

      if (!treeAppleDefId) {
        throw new Error("Nao foi possivel localizar ga_actor_def TREE_APPLE.");
      }

      const treeDecorDefId = await findSingleId(
        queryInterface,
        transaction,
        `
        SELECT id
        FROM ga_actor_def
        WHERE code = 'TREE_DECOR'
        LIMIT 1
        `
      );

      if (treeDecorDefId) {
        const [runtimeRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_runtime
          WHERE actor_def_id = :actorDefId
            AND instance_id = 6
            AND pos_x = :posX
            AND pos_y = :posY
            AND pos_z = :posZ
          LIMIT 1
          `,
          {
            transaction,
            replacements: {
              actorDefId: treeDecorDefId,
              posX: TREE_POS.x,
              posY: TREE_POS.y,
              posZ: TREE_POS.z,
            },
          }
        );

        const runtimeId = Number(runtimeRows?.[0]?.id ?? 0) || null;
        if (runtimeId) {
          await queryInterface.bulkUpdate(
            "ga_actor_runtime",
            {
              actor_def_id: Number(treeAppleDefId),
              state_json: JSON.stringify({
                resourceType: "APPLE_TREE",
                visualHint: "TREE",
              }),
              updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            { id: runtimeId },
            { transaction }
          );
        }

        const [spawnRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_spawn
          WHERE actor_def_id = :actorDefId
            AND instance_id = 6
            AND pos_x = :posX
            AND pos_y = :posY
            AND pos_z = :posZ
          LIMIT 1
          `,
          {
            transaction,
            replacements: {
              actorDefId: treeDecorDefId,
              posX: TREE_POS.x,
              posY: TREE_POS.y,
              posZ: TREE_POS.z,
            },
          }
        );

        const spawnId = Number(spawnRows?.[0]?.id ?? 0) || null;
        if (spawnId) {
          await queryInterface.bulkUpdate(
            "ga_actor_spawn",
            {
              actor_def_id: Number(treeAppleDefId),
              updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            { id: spawnId },
            { transaction }
          );
        }

        const [remainingRuntimeRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_runtime
          WHERE actor_def_id = :actorDefId
          LIMIT 1
          `,
          {
            transaction,
            replacements: { actorDefId: treeDecorDefId },
          }
        );

        const [remainingSpawnRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_spawn
          WHERE actor_def_id = :actorDefId
          LIMIT 1
          `,
          {
            transaction,
            replacements: { actorDefId: treeDecorDefId },
          }
        );

        if (!remainingRuntimeRows?.[0] && !remainingSpawnRows?.[0]) {
          await queryInterface.bulkDelete("ga_actor_def", { id: treeDecorDefId }, { transaction });
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const treeDecorDefId = await findSingleId(
        queryInterface,
        transaction,
        `
        SELECT id
        FROM ga_actor_def
        WHERE code = 'TREE_DECOR'
        LIMIT 1
        `
      );

      if (treeDecorDefId) return;

      await queryInterface.bulkInsert(
        "ga_actor_def",
        [
          {
            code: "TREE_DECOR",
            name: "Tree",
            actor_kind: "OBJECT",
            visual_hint: "TREE",
            asset_key: "Apple tree.glb",
            default_state_json: JSON.stringify({
              visualHint: "TREE",
            }),
            default_container_def_id: null,
            is_active: true,
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );
    });
  },
};
