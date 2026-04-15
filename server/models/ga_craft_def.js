"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaCraftDef = sequelize.define(
    "GaCraftDef",
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
      skill_def_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "ga_skill_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      required_skill_level: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      required_research_def_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "ga_research_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      required_research_level: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      output_item_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_item_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      output_qty: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      craft_time_ms: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      stamina_cost_total: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      xp_reward: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_craft_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["skill_def_id"] },
        { fields: ["required_research_def_id"] },
        { fields: ["output_item_def_id"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaCraftDef.associate = (models) => {
    GaCraftDef.belongsTo(models.GaSkillDef, {
      foreignKey: "skill_def_id",
      as: "skillDef",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    GaCraftDef.belongsTo(models.GaResearchDef, {
      foreignKey: "required_research_def_id",
      as: "requiredResearchDef",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    GaCraftDef.belongsTo(models.GaItemDef, {
      foreignKey: "output_item_def_id",
      as: "outputItemDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaCraftDef.hasMany(models.GaCraftRecipeItem, {
      foreignKey: "craft_def_id",
      as: "recipeItems",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaCraftDef.hasMany(models.GaUserCraftJob, {
      foreignKey: "craft_def_id",
      as: "userCraftJobs",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaCraftDef;
};
