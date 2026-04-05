"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaUserMacroConfig = sequelize.define(
    "GaUserMacroConfig",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },

      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ga_user",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      macro_code: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      config_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      state_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "ga_user_macro_config",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["user_id"] },
        { unique: true, fields: ["user_id", "macro_code"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaUserMacroConfig.associate = (models) => {
    GaUserMacroConfig.belongsTo(models.GaUser, {
      foreignKey: "user_id",
      as: "user",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaUserMacroConfig;
};
