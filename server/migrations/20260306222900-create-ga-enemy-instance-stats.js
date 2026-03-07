"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_enemy_instance_stats", {
      enemy_instance_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "ga_enemy_instance",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      hp_current: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      hp_max: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      move_speed: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },

      attack_speed: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_enemy_instance_stats
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex(
      "ga_enemy_instance_stats",
      ["hp_current"],
      {
        name: "ix_ga_enemy_instance_stats_hp_current",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "ga_enemy_instance_stats",
      "ix_ga_enemy_instance_stats_hp_current"
    ).catch(() => {});

    await queryInterface.dropTable("ga_enemy_instance_stats");
  },
};