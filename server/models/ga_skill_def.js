"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSkillDef = sequelize.define(
    "GaSkillDef",
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
      tableName: "ga_skill_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaSkillDef.associate = (models) => {
    GaSkillDef.hasMany(models.GaSkillLevelDef, {
      foreignKey: "skill_def_id",
      as: "levels",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaSkillDef.hasMany(models.GaUserSkill, {
      foreignKey: "skill_def_id",
      as: "userSkills",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaSkillDef.hasMany(models.GaCraftDef, {
      foreignKey: "skill_def_id",
      as: "craftDefs",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  };

  return GaSkillDef;
};
