"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSpawnDef = sequelize.define(
    "GaSpawnDef",
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
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      spawn_kind: {
        type: DataTypes.ENUM("ENEMY"),
        allowNull: false,
        defaultValue: "ENEMY",
      },
      shape_kind: {
        type: DataTypes.ENUM("POINT", "CIRCLE"),
        allowNull: false,
        defaultValue: "POINT",
      },
      radius: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
      },
      max_alive: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      respawn_ms: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30000,
      },
      patrol_radius: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 5,
      },
      patrol_wait_ms: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 10000,
      },
      patrol_stop_radius: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0.5,
      },
    },
    {
      tableName: "ga_spawn_def",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["status"] },
      ],
    }
  );

  GaSpawnDef.associate = (models) => {
    GaSpawnDef.hasMany(models.GaSpawnDefEnemy, {
      foreignKey: "spawn_def_id",
      as: "enemies",
    });

    GaSpawnDef.hasMany(models.GaSpawnInstance, {
      foreignKey: "spawn_def_id",
      as: "instances",
    });
  };

  return GaSpawnDef;
};
