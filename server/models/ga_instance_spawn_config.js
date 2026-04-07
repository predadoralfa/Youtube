"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaInstanceSpawnConfig = sequelize.define(
    "GaInstanceSpawnConfig",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      instance_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      enemy_spawn_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      respawn_multiplier: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      spawn_quantity_multiplier: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      max_alive_multiplier: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      spawn_tick_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "ga_instance_spawn_config",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["instance_id"] },
        { fields: ["enemy_spawn_enabled"] },
      ],
    }
  );

  GaInstanceSpawnConfig.associate = (models) => {
    GaInstanceSpawnConfig.belongsTo(models.GaInstance, {
      foreignKey: "instance_id",
      as: "instance",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaInstanceSpawnConfig;
};
