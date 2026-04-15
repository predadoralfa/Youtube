"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaCraftRecipeItem = sequelize.define(
    "GaCraftRecipeItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      craft_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_craft_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      item_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_item_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      quantity: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      role: {
        type: DataTypes.ENUM("INPUT", "CATALYST"),
        allowNull: false,
        defaultValue: "INPUT",
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "ga_craft_recipe_item",
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ["craft_def_id"] },
        { fields: ["item_def_id"] },
        { fields: ["sort_order"] },
      ],
    }
  );

  GaCraftRecipeItem.associate = (models) => {
    GaCraftRecipeItem.belongsTo(models.GaCraftDef, {
      foreignKey: "craft_def_id",
      as: "craftDef",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaCraftRecipeItem.belongsTo(models.GaItemDef, {
      foreignKey: "item_def_id",
      as: "itemDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaCraftRecipeItem;
};
