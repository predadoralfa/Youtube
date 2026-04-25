"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_instance_resource_config", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
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
      resource_regen_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      resource_regen_multiplier: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      resource_regen_tick_ms: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 60000,
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

    await queryInterface.addIndex("ga_instance_resource_config", ["instance_id"], {
      unique: true,
      name: "ix_ga_instance_resource_config_instance",
    });

    await queryInterface.addIndex("ga_instance_resource_config", ["resource_regen_enabled"], {
      name: "ix_ga_instance_resource_config_enabled",
    });

    await queryInterface.sequelize.query(`
      INSERT INTO ga_instance_resource_config (
        instance_id,
        resource_regen_enabled,
        resource_regen_multiplier,
        resource_regen_tick_ms,
        created_at,
        updated_at
      )
      SELECT
        i.id,
        1,
        1.000,
        60000,
        NOW(),
        NOW()
      FROM ga_instance i
      LEFT JOIN ga_instance_resource_config rc ON rc.instance_id = i.id
      WHERE rc.instance_id IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_instance_resource_config", "ix_ga_instance_resource_config_enabled");
    await queryInterface.removeIndex("ga_instance_resource_config", "ix_ga_instance_resource_config_instance");
    await queryInterface.dropTable("ga_instance_resource_config");
  },
};
