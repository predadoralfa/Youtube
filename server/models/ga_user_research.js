"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaUserResearch = sequelize.define(
    "GaUserResearch",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_user", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      research_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_research_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      current_level: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("IDLE", "RUNNING", "COMPLETED"),
        allowNull: false,
        defaultValue: "IDLE",
      },
      active_level: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      progress_ms: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      started_at_ms: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      completed_at_ms: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      tableName: "ga_user_research",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["user_id"] },
        { fields: ["research_def_id"] },
        { unique: true, fields: ["user_id", "research_def_id"] },
        { fields: ["status"] },
      ],
    }
  );

  GaUserResearch.associate = (models) => {
    GaUserResearch.belongsTo(models.GaUser, {
      foreignKey: "user_id",
      as: "user",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaUserResearch.belongsTo(models.GaResearchDef, {
      foreignKey: "research_def_id",
      as: "researchDef",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaUserResearch;
};
