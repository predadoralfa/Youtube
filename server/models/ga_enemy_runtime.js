"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaEnemyRuntime = sequelize.define(
    "GaEnemyRuntime",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      spawn_instance_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      spawn_def_component_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      enemy_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ALIVE", "DEAD", "DESPAWNED"),
        allowNull: false,
        defaultValue: "ALIVE",
      },
      pos_x: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
      pos_z: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
      yaw: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
      },
      home_x: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
      },
      home_z: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
      },
      spawned_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      dead_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      respawn_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "ga_enemy_runtime",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["spawn_instance_id"] },
        { fields: ["spawn_def_component_id"] },
        { fields: ["enemy_def_id"] },
        { fields: ["status"] },
        { fields: ["respawn_at"] },
      ],
    }
  );

  GaEnemyRuntime.associate = (models) => {
    GaEnemyRuntime.belongsTo(models.GaSpawnInstance, {
      foreignKey: "spawn_instance_id",
      as: "spawnInstance",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaEnemyRuntime.belongsTo(models.GaSpawnDefComponent, {
      foreignKey: "spawn_def_component_id",
      as: "spawnDefComponent",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaEnemyRuntime.belongsTo(models.GaEnemyDef, {
      foreignKey: "enemy_def_id",
      as: "enemyDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaEnemyRuntime.hasOne(models.GaEnemyRuntimeStats, {
      foreignKey: "enemy_runtime_id",
      as: "stats",
    });
  };

  return GaEnemyRuntime;
};
