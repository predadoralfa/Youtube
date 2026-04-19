"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("ga_user_craft_job", { transaction }).catch(() => null);
      if (!table || !table.craft_time_ms) {
        await queryInterface.addColumn(
          "ga_user_craft_job",
          "craft_time_ms",
          {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: true,
            defaultValue: null,
          },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `
        UPDATE ga_user_craft_job j
        JOIN ga_craft_def c ON c.id = j.craft_def_id
        SET j.craft_time_ms = COALESCE(j.craft_time_ms, c.craft_time_ms)
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("ga_user_craft_job", { transaction }).catch(() => null);
      if (table && table.craft_time_ms) {
        await queryInterface.removeColumn("ga_user_craft_job", "craft_time_ms", { transaction });
      }
    });
  },
};
