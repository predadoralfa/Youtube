"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaInstanceResourceConfig = sequelize.define(
    "GaInstanceResourceConfig",
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
      resource_regen_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      resource_regen_multiplier: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 1,
      },
      resource_regen_tick_ms: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60000,
      },
    },
    {
      tableName: "ga_instance_resource_config",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["instance_id"] },
        { fields: ["resource_regen_enabled"] },
      ],
    }
  );

  GaInstanceResourceConfig.associate = (models) => {
    GaInstanceResourceConfig.belongsTo(models.GaInstance, {
      foreignKey: "instance_id",
      as: "instance",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaInstanceResourceConfig;
};
