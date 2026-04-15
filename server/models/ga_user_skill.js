"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaUserSkill = sequelize.define(
    "GaUserSkill",
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
      skill_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_skill_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      current_level: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      current_xp: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      total_xp: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "ga_user_skill",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["user_id", "skill_def_id"] },
        { fields: ["user_id"] },
        { fields: ["skill_def_id"] },
      ],
    }
  );

  GaUserSkill.associate = (models) => {
    GaUserSkill.belongsTo(models.GaUser, {
      foreignKey: "user_id",
      as: "user",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaUserSkill.belongsTo(models.GaSkillDef, {
      foreignKey: "skill_def_id",
      as: "skillDef",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaUserSkill;
};
