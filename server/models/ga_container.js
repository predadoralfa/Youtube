"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaContainer = sequelize.define(
    "GaContainer",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },

      container_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      slot_role: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },

      state: {
        type: DataTypes.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      rev: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 1,
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
      tableName: "ga_container",
      timestamps: false,
      underscored: true,
    }
  );

  GaContainer.associate = (models) => {
    GaContainer.belongsTo(models.GaContainerDef, {
      foreignKey: "container_def_id",
      as: "containerDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaContainer;
};