"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaActorResourceRuleDef = sequelize.define(
    "GaActorResourceRuleDef",
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
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      actor_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      container_slot_role: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: "LOOT",
      },
      item_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      refill_amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      refill_interval_ms: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 300000,
      },
      max_qty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 15,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_actor_resource_rule_def",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["actor_def_id"] },
        { fields: ["item_def_id"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaActorResourceRuleDef.associate = (models) => {
    GaActorResourceRuleDef.belongsTo(models.GaActorDef, {
      foreignKey: "actor_def_id",
      as: "actorDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaActorResourceRuleDef.belongsTo(models.GaItemDef, {
      foreignKey: "item_def_id",
      as: "itemDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaActorResourceRuleDef.hasMany(models.GaActorResourceState, {
      foreignKey: "rule_def_id",
      as: "states",
    });
  };

  return GaActorResourceRuleDef;
};
