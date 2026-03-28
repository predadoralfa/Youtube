"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        "ga_enemy_def",
        [
          {
            code: "WILD_RABBIT",
            name: "Wild Rabbit",
            status: "ACTIVE",
            visual_kind: "RABBIT",
            collision_radius: 0.4,
            ai_profile_json: null,
            flags_json: JSON.stringify({ aggressive: false }),
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );

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
        throw new Error("Não foi possível localizar ga_enemy_def do WILD_RABBIT após insert.");
      }

      await queryInterface.bulkInsert(
        "ga_enemy_def_stats",
        [
          {
            enemy_def_id: enemyDefId,
            hp_max: 10,
            move_speed: 1.2,
            attack_speed: 0.3,
            defense: 0,
            attack_range: 1.2,
            attack_power: 5,
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

      if (enemyDefId) {
        await queryInterface.bulkDelete(
          "ga_enemy_def_stats",
          { enemy_def_id: enemyDefId },
          { transaction }
        );

        await queryInterface.bulkDelete(
          "ga_enemy_def",
          { id: enemyDefId },
          { transaction }
        );
      }
    });
  },
};
