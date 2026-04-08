"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSpawnDefEnemy = sequelize.define(
    "GaSpawnDefEnemy",
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
      tableName: "ga_spawn_def_enemy",
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

  GaSpawnDefEnemy.associate = (models) => {
    GaSpawnDefEnemy.belongsTo(models.GaSpawnDef, {
      foreignKey: "spawn_def_id",
      as: "spawnDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaSpawnDefEnemy.belongsTo(models.GaEnemyDef, {
      foreignKey: "enemy_def_id",
      as: "enemyDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaSpawnDefEnemy.hasMany(models.GaSpawnInstanceEnemy, {
      foreignKey: "spawn_def_enemy_id",
      as: "instanceEnemies",
    });
  };

  return GaSpawnDefEnemy;
};
