"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaResearchLevelDef = sequelize.define(
    "GaResearchLevelDef",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      research_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_research_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      level: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      study_time_ms: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
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
      requirements_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "ga_research_level_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["research_def_id", "level"] },
        { fields: ["level"] },
      ],
    }
  );

  GaResearchLevelDef.associate = (models) => {
    GaResearchLevelDef.belongsTo(models.GaResearchDef, {
      foreignKey: "research_def_id",
      as: "researchDef",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaResearchLevelDef;
};
