// server/models/ga_era_def.js
module.exports = (sequelize, DataTypes) => {
  const GaEraDef = sequelize.define(
    "GaEraDef",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      code: { type: DataTypes.STRING(64), allowNull: false, unique: true },

      name: { type: DataTypes.STRING(80), allowNull: false },

      order_index: { type: DataTypes.INTEGER, allowNull: false, unique: true },

      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "ga_era_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { unique: true, fields: ["order_index"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaEraDef.associate = (models) => {
    GaEraDef.hasMany(models.GaItemDef, {
      foreignKey: "era_min_id",
      as: "items",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    GaEraDef.hasMany(models.GaInstance, {
      foreignKey: "current_era_id",
      as: "instances",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaEraDef;
};