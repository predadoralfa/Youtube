"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_enemy_def", "visual_scale", {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 1.0,
      after: "asset_key",
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_enemy_def
      SET visual_scale = CASE
        WHEN code = 'WILD_RABBIT' THEN 2.100
        ELSE 1.000
      END
      WHERE visual_scale IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_enemy_def", "visual_scale");
  },
};
