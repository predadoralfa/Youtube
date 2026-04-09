"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_enemy_def", "asset_key", {
      type: Sequelize.STRING(128),
      allowNull: true,
      after: "visual_kind",
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_enemy_def
      SET asset_key = CASE
        WHEN code = 'WILD_RABBIT' THEN 'RABBIT'
        ELSE NULL
      END
      WHERE asset_key IS NULL
    `);

    await queryInterface.addIndex("ga_enemy_def", ["asset_key"], {
      name: "ix_ga_enemy_def_asset_key",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_enemy_def", "ix_ga_enemy_def_asset_key");
    await queryInterface.removeColumn("ga_enemy_def", "asset_key");
  },
};
