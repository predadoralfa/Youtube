"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_user_macro_config", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      macro_code: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      config_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      state_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint("ga_user_macro_config", {
      fields: ["user_id"],
      type: "foreign key",
      name: "fk_ga_user_macro_config_user_id",
      references: { table: "ga_user", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addConstraint("ga_user_macro_config", {
      fields: ["user_id", "macro_code"],
      type: "unique",
      name: "uq_ga_user_macro_config_user_macro",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ga_user_macro_config");
  },
};
