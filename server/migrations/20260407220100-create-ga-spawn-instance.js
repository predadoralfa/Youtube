"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_spawn_instance", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      instance_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_instance",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      spawn_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_def",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      pos_x: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      pos_z: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      yaw: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      override_json: {
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
      ALTER TABLE ga_spawn_instance
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_spawn_instance", ["instance_id"], {
      name: "ix_ga_spawn_instance_instance",
    });
    await queryInterface.addIndex("ga_spawn_instance", ["spawn_def_id"], {
      name: "ix_ga_spawn_instance_spawn_def",
    });
    await queryInterface.addIndex("ga_spawn_instance", ["status"], {
      name: "ix_ga_spawn_instance_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_spawn_instance", "ix_ga_spawn_instance_status").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_instance", "ix_ga_spawn_instance_spawn_def").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_instance", "ix_ga_spawn_instance_instance").catch(() => {});
    await queryInterface.dropTable("ga_spawn_instance");
  },
};
