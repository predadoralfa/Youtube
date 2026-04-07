"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaActorResourceState = sequelize.define(
    "GaActorResourceState",
    {
      actor_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
      },
      rule_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      current_qty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_refill_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      next_refill_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      state: {
        type: DataTypes.ENUM("ACTIVE", "PAUSED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      rev: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "ga_actor_resource_state",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["actor_id"] },
        { fields: ["rule_def_id"] },
        { fields: ["next_refill_at"] },
        { fields: ["state"] },
      ],
    }
  );

  GaActorResourceState.associate = (models) => {
    GaActorResourceState.belongsTo(models.GaActorRuntime, {
      foreignKey: "actor_id",
      as: "actor",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaActorResourceState.belongsTo(models.GaActorResourceRuleDef, {
      foreignKey: "rule_def_id",
      as: "ruleDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaActorResourceState;
};
