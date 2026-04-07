"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_instance_spawn_config", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      instance_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "ga_instance",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      enemy_spawn_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      respawn_multiplier: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      spawn_quantity_multiplier: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      max_alive_multiplier: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      spawn_tick_ms: {
        type: Sequelize.INTEGER,
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
      ALTER TABLE ga_instance_spawn_config
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_instance_spawn_config", ["instance_id"], {
      name: "ix_ga_instance_spawn_config_instance",
      unique: true,
    });

    await queryInterface.addIndex("ga_instance_spawn_config", ["enemy_spawn_enabled"], {
      name: "ix_ga_instance_spawn_config_enemy_enabled",
    });

    const [instanceRows] = await queryInterface.sequelize.query(`
      SELECT id
      FROM ga_instance
      ORDER BY id ASC
    `);

    if (instanceRows.length > 0) {
      await queryInterface.bulkInsert(
        "ga_instance_spawn_config",
        instanceRows.map((row) => ({
          instance_id: Number(row.id),
          enemy_spawn_enabled: true,
          respawn_multiplier: 1,
          spawn_quantity_multiplier: 1,
          max_alive_multiplier: 1,
          spawn_tick_ms: null,
          created_at: new Date(),
          updated_at: new Date(),
        }))
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "ga_instance_spawn_config",
      "ix_ga_instance_spawn_config_enemy_enabled"
    ).catch(() => {});

    await queryInterface.removeIndex(
      "ga_instance_spawn_config",
      "ix_ga_instance_spawn_config_instance"
    ).catch(() => {});

    await queryInterface.dropTable("ga_instance_spawn_config");
  },
};
