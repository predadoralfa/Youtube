"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSpawnInstanceEnemy = sequelize.define(
    "GaSpawnInstanceEnemy",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      spawn_instance_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      spawn_def_enemy_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      slot_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ALIVE", "DEAD", "DISABLED"),
        allowNull: false,
        defaultValue: "ALIVE",
      },
      hp_current: {
        type: DataTypes.INTEGER,
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
      tableName: "ga_spawn_instance_enemy",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["spawn_instance_id"] },
        { fields: ["spawn_def_enemy_id"] },
        { fields: ["status"] },
        { fields: ["respawn_at"] },
        {
          unique: true,
          fields: ["spawn_instance_id", "spawn_def_enemy_id", "slot_index"],
        },
      ],
    }
  );

  GaSpawnInstanceEnemy.associate = (models) => {
    GaSpawnInstanceEnemy.belongsTo(models.GaSpawnInstance, {
      foreignKey: "spawn_instance_id",
      as: "spawnInstance",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaSpawnInstanceEnemy.belongsTo(models.GaSpawnDefEnemy, {
      foreignKey: "spawn_def_enemy_id",
      as: "spawnDefEnemy",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaSpawnInstanceEnemy;
};
