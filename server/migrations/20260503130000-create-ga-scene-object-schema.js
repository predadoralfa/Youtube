"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "ga_scene_object_def",
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          code: {
            type: Sequelize.STRING(64),
            allowNull: false,
            unique: true,
          },
          name: {
            type: Sequelize.STRING(128),
            allowNull: false,
          },
          category: {
            type: Sequelize.STRING(64),
            allowNull: true,
          },
          asset_key: {
            type: Sequelize.STRING(128),
            allowNull: true,
          },
          default_state_json: {
            type: Sequelize.JSON,
            allowNull: true,
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );

      await queryInterface.createTable(
        "ga_scene_object",
        {
          id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          scene_object_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "ga_scene_object_def",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
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
          pos_x: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          pos_y: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          pos_z: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          yaw: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          scale_x: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 1,
          },
          scale_y: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 1,
          },
          scale_z: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 1,
          },
          state_json: {
            type: Sequelize.JSON,
            allowNull: true,
          },
          status: {
            type: Sequelize.ENUM("ACTIVE", "DISABLED"),
            allowNull: false,
            defaultValue: "ACTIVE",
          },
          rev: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 1,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );

      await queryInterface.addIndex("ga_scene_object_def", ["code"], {
        name: "ga_scene_object_def_code",
        unique: true,
        transaction,
      });
      await queryInterface.addIndex("ga_scene_object_def", ["category"], {
        name: "ga_scene_object_def_category",
        transaction,
      });
      await queryInterface.addIndex("ga_scene_object_def", ["asset_key"], {
        name: "ga_scene_object_def_asset_key",
        transaction,
      });
      await queryInterface.addIndex("ga_scene_object_def", ["is_active"], {
        name: "ga_scene_object_def_is_active",
        transaction,
      });

      await queryInterface.addIndex("ga_scene_object", ["scene_object_def_id"], {
        name: "ga_scene_object_scene_object_def_id",
        transaction,
      });
      await queryInterface.addIndex("ga_scene_object", ["instance_id"], {
        name: "ga_scene_object_instance_id",
        transaction,
      });
      await queryInterface.addIndex("ga_scene_object", ["status"], {
        name: "ga_scene_object_status",
        transaction,
      });
      await queryInterface.addIndex("ga_scene_object", ["instance_id", "status"], {
        name: "ga_scene_object_instance_id_status",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("ga_scene_object", { transaction });
      await queryInterface.dropTable("ga_scene_object_def", { transaction });
    });
  },
};
