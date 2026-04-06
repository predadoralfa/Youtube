"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaResearchDef = sequelize.define(
    "GaResearchDef",
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
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      item_def_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "ga_item_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      era_min_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "ga_era_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      max_level: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_research_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["item_def_id"] },
        { fields: ["era_min_id"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaResearchDef.associate = (models) => {
    GaResearchDef.belongsTo(models.GaItemDef, {
      foreignKey: "item_def_id",
      as: "itemDef",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    GaResearchDef.belongsTo(models.GaEraDef, {
      foreignKey: "era_min_id",
      as: "eraMin",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    GaResearchDef.hasMany(models.GaResearchLevelDef, {
      foreignKey: "research_def_id",
      as: "levels",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaResearchDef.hasMany(models.GaUserResearch, {
      foreignKey: "research_def_id",
      as: "userResearch",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaResearchDef;
};
