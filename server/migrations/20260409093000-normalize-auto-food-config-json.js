"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_user_macro_config
        SET config_json = JSON_OBJECT(
          'itemInstanceId', NULL,
          'hungerThreshold', 60
        )
        WHERE macro_code = 'AUTO_FOOD'
          AND config_json IS NULL
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_user_macro_config
        SET config_json = NULL
        WHERE macro_code = 'AUTO_FOOD'
          AND JSON_EXTRACT(config_json, '$.itemInstanceId') IS NULL
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.hungerThreshold')) AS UNSIGNED) = 60
        `,
        { transaction }
      );
    });
  },
};
