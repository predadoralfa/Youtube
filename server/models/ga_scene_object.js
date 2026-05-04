"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSceneObject = sequelize.define(
    "GaSceneObject",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      scene_object_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      instance_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ga_instance",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      pos_x: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      pos_y: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      pos_z: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      yaw: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      scale_x: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      scale_y: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      scale_z: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      state_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      rev: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "ga_scene_object",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["scene_object_def_id"] },
        { fields: ["instance_id"] },
        { fields: ["status"] },
        { fields: ["instance_id", "status"] },
      ],
    }
  );

  GaSceneObject.associate = (models) => {
    GaSceneObject.belongsTo(models.GaSceneObjectDef, {
      foreignKey: "scene_object_def_id",
      as: "sceneObjectDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaSceneObject.belongsTo(models.GaInstance, {
      foreignKey: "instance_id",
      as: "instance",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaSceneObject;
};
