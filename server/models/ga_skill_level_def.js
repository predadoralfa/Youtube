"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaSkillLevelDef = sequelize.define(
    "GaSkillLevelDef",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      skill_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_skill_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      level: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      required_xp: {
        type: DataTypes.DECIMAL(65, 0),
        allowNull: false,
        defaultValue: 0,
      },
      title: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      grants_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      bonuses_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "ga_skill_level_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["skill_def_id", "level"] },
        { fields: ["skill_def_id"] },
        { fields: ["level"] },
      ],
    }
  );

  GaSkillLevelDef.associate = (models) => {
    GaSkillLevelDef.belongsTo(models.GaSkillDef, {
      foreignKey: "skill_def_id",
      as: "skillDef",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaSkillLevelDef;
};
