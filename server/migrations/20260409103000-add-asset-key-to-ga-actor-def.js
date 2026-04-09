"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_actor_def", "asset_key", {
      type: Sequelize.STRING(128),
      allowNull: true,
      after: "visual_hint",
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_actor_def
      SET asset_key = CASE
        WHEN code = 'CHEST_TEST' THEN 'CHEST'
        WHEN code = 'TREE_APPLE' THEN 'TREE'
        WHEN code = 'ROCK_NODE_SMALL' THEN 'ROCK'
        WHEN code = 'GROUND_LOOT' THEN 'ITEM_DROP'
        ELSE NULL
      END
      WHERE asset_key IS NULL
    `);

    await queryInterface.addIndex("ga_actor_def", ["asset_key"], {
      name: "ga_actor_def_asset_key",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_actor_def", "ga_actor_def_asset_key");
    await queryInterface.removeColumn("ga_actor_def", "asset_key");
  },
};
