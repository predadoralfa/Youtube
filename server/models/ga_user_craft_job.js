"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaUserCraftJob = sequelize.define(
    "GaUserCraftJob",
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
      craft_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_craft_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: DataTypes.ENUM("PENDING", "RUNNING", "PAUSED", "COMPLETED", "CANCELLED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      current_progress_ms: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      stamina_spent: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      craft_time_ms: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      started_at_ms: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      paused_at_ms: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      completed_at_ms: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "ga_user_craft_job",
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ["user_id"] },
        { fields: ["craft_def_id"] },
        { fields: ["status"] },
      ],
    }
  );

  GaUserCraftJob.associate = (models) => {
    GaUserCraftJob.belongsTo(models.GaUser, {
      foreignKey: "user_id",
      as: "user",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaUserCraftJob.belongsTo(models.GaCraftDef, {
      foreignKey: "craft_def_id",
      as: "craftDef",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaUserCraftJob;
};
