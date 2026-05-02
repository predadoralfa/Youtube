"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      "ga_actor_def",
      {
        asset_key: "Herbs.glb",
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      {
        code: "HERBS_PATCH",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      "ga_actor_def",
      {
        asset_key: "Grass.glb",
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      {
        code: "HERBS_PATCH",
      }
    );
  },
};
