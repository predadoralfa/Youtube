"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSceneObjectDef = sequelize.define(
    "GaSceneObjectDef",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      code: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      asset_key: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      default_state_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_scene_object_def",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["category"] },
        { fields: ["asset_key"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaSceneObjectDef.associate = (models) => {
    GaSceneObjectDef.hasMany(models.GaSceneObject, {
      foreignKey: "scene_object_def_id",
      as: "sceneObjects",
    });
  };

  return GaSceneObjectDef;
};
