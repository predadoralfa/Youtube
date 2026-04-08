"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSpawnInstance = sequelize.define(
    "GaSpawnInstance",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      instance_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      spawn_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
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
      override_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "ga_spawn_instance",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["instance_id"] },
        { fields: ["spawn_def_id"] },
        { fields: ["status"] },
      ],
    }
  );

  GaSpawnInstance.associate = (models) => {
    GaSpawnInstance.belongsTo(models.GaInstance, {
      foreignKey: "instance_id",
      as: "instance",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaSpawnInstance.belongsTo(models.GaSpawnDef, {
      foreignKey: "spawn_def_id",
      as: "spawnDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaSpawnInstance.hasMany(models.GaEnemyRuntime, {
      foreignKey: "spawn_instance_id",
      as: "enemyRuntimes",
    });
  };

  return GaSpawnInstance;
};
