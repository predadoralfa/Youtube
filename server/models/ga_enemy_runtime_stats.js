"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaEnemyRuntimeStats = sequelize.define(
    "GaEnemyRuntimeStats",
    {
      enemy_runtime_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      hp_current: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      hp_max: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      move_speed: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
      attack_speed: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
    },
    {
      tableName: "ga_enemy_runtime_stats",
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ["hp_current"] }],
    }
  );

  GaEnemyRuntimeStats.associate = (models) => {
    GaEnemyRuntimeStats.belongsTo(models.GaEnemyRuntime, {
      foreignKey: "enemy_runtime_id",
      as: "enemyRuntime",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaEnemyRuntimeStats;
};
