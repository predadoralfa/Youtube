"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_research_level_def", "title", {
      type: Sequelize.STRING(120),
      allowNull: true,
    });

    await queryInterface.addColumn("ga_research_level_def", "description", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_research_level_def", "description");
    await queryInterface.removeColumn("ga_research_level_def", "title");
  },
};
