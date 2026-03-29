"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaEquippedItem = sequelize.define(
    "GaEquippedItem",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },

      owner_kind: {
        type: DataTypes.ENUM("PLAYER"),
        allowNull: false,
      },

      owner_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      slot_def_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },

      item_instance_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      tableName: "ga_equipped_item",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["owner_kind", "owner_id"] },
        { unique: true, fields: ["owner_kind", "owner_id", "slot_def_id"] },
        { unique: true, fields: ["item_instance_id"] },
      ],
    }
  );

  GaEquippedItem.associate = (models) => {
    GaEquippedItem.belongsTo(models.GaEquipmentSlotDef, {
      foreignKey: "slot_def_id",
      as: "slotDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaEquippedItem.belongsTo(models.GaItemInstance, {
      foreignKey: "item_instance_id",
      as: "itemInstance",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaEquippedItem;
};
