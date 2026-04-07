"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        INSERT INTO ga_user_macro_config
          (user_id, macro_code, is_active, config_json, state_json, created_at, updated_at)
        SELECT
          u.id AS user_id,
          'AUTO_FOOD' AS macro_code,
          0 AS is_active,
          NULL AS config_json,
          JSON_OBJECT('seed', 'AUTO_FOOD_BACKFILL_V1') AS state_json,
          CURRENT_TIMESTAMP AS created_at,
          CURRENT_TIMESTAMP AS updated_at
        FROM ga_user u
        LEFT JOIN ga_user_macro_config m
          ON m.user_id = u.id
         AND m.macro_code = 'AUTO_FOOD'
        WHERE m.user_id IS NULL
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        DELETE FROM ga_user_macro_config
        WHERE macro_code = 'AUTO_FOOD'
          AND is_active = 0
          AND config_json IS NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(state_json, '$.seed')) = 'AUTO_FOOD_BACKFILL_V1'
        `,
        { transaction }
      );
    });
  },
};

