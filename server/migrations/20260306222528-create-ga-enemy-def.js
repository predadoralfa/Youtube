"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_enemy_def", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      code: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      visual_kind: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "DEFAULT",
      },

      collision_radius: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0.5,
      },

      ai_profile_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      flags_json: {
        type: Sequelize.JSON,
        allowNull: true,
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
      ALTER TABLE ga_enemy_def
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addConstraint("ga_enemy_def", {
      type: "unique",
      name: "uq_ga_enemy_def_code",
      fields: ["code"],
    });

    await queryInterface.addIndex("ga_enemy_def", ["status"], {
      name: "ix_ga_enemy_def_status",
    });

    await queryInterface.addIndex("ga_enemy_def", ["visual_kind"], {
      name: "ix_ga_enemy_def_visual_kind",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_enemy_def", "ix_ga_enemy_def_visual_kind").catch(() => {});
    await queryInterface.removeIndex("ga_enemy_def", "ix_ga_enemy_def_status").catch(() => {});
    await queryInterface.removeConstraint("ga_enemy_def", "uq_ga_enemy_def_code").catch(() => {});
    await queryInterface.dropTable("ga_enemy_def");
  },
};