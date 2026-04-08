"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_spawn_point", "spawn_def_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "ga_spawn_def",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      after: "instance_id",
    });

    await queryInterface.addIndex("ga_spawn_point", ["spawn_def_id"], {
      name: "ix_ga_spawn_point_spawn_def",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_spawn_point", "ix_ga_spawn_point_spawn_def").catch(() => {});
    await queryInterface.removeColumn("ga_spawn_point", "spawn_def_id");
  },
};
