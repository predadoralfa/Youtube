"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSpawnDefComponent = sequelize.define(
    "GaSpawnDefComponent",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      spawn_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      enemy_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "ga_spawn_def_component",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["spawn_def_id"] },
        { fields: ["enemy_def_id"] },
        { fields: ["status"] },
        { fields: ["sort_order"] },
      ],
    }
  );

  GaSpawnDefComponent.associate = (models) => {
    GaSpawnDefComponent.belongsTo(models.GaSpawnDef, {
      foreignKey: "spawn_def_id",
      as: "spawnDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaSpawnDefComponent.belongsTo(models.GaEnemyDef, {
      foreignKey: "enemy_def_id",
      as: "enemyDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaSpawnDefComponent.hasMany(models.GaEnemyRuntime, {
      foreignKey: "spawn_def_component_id",
      as: "enemyRuntimes",
    });
  };

  return GaSpawnDefComponent;
};
