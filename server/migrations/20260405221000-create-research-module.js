"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_research_def", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      item_def_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "ga_item_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      era_min_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "ga_era_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      max_level: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    });

    await queryInterface.addIndex("ga_research_def", ["item_def_id"]);
    await queryInterface.addIndex("ga_research_def", ["era_min_id"]);
    await queryInterface.addIndex("ga_research_def", ["is_active"]);

    await queryInterface.createTable("ga_research_level_def", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      research_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "ga_research_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      level: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      study_time_ms: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      grants_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      requirements_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },
    });

    await queryInterface.addIndex("ga_research_level_def", ["level"]);
    await queryInterface.addConstraint("ga_research_level_def", {
      fields: ["research_def_id", "level"],
      type: "unique",
      name: "uq_ga_research_level_def_research_level",
    });

    await queryInterface.createTable("ga_user_research", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "ga_user", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      research_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "ga_research_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      current_level: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM("IDLE", "RUNNING", "COMPLETED"),
        allowNull: false,
        defaultValue: "IDLE",
      },
      active_level: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      progress_ms: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      started_at_ms: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      completed_at_ms: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex("ga_user_research", ["user_id"]);
    await queryInterface.addIndex("ga_user_research", ["research_def_id"]);
    await queryInterface.addIndex("ga_user_research", ["status"]);
    await queryInterface.addConstraint("ga_user_research", {
      fields: ["user_id", "research_def_id"],
      type: "unique",
      name: "uq_ga_user_research_user_research",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ga_user_research");
    await queryInterface.dropTable("ga_research_level_def");
    await queryInterface.dropTable("ga_research_def");
  },
};
