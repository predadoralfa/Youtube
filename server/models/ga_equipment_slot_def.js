"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaEquipmentSlotDef = sequelize.define(
    "GaEquipmentSlotDef",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },

      code: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },

      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },

      slot_kind: {
        type: DataTypes.ENUM("WEAR", "USAGE"),
        allowNull: false,
        defaultValue: "WEAR",
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_equipment_slot_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["slot_kind"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaEquipmentSlotDef.associate = (models) => {
    GaEquipmentSlotDef.hasMany(models.GaEquippedItem, {
      foreignKey: "slot_def_id",
      as: "equippedItems",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaEquipmentSlotDef;
};
