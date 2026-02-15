// server/models/ga_material.js
module.exports = (sequelize, DataTypes) => {
  const GaMaterial = sequelize.define(
    "GaMaterial",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },

      code: {
        type: DataTypes.STRING(48),
        allowNull: false,
        unique: true
      },

      name: {
        type: DataTypes.STRING(80),
        allowNull: false
      },

      friction: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.8
      },

      restitution: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.1
      }
    },
    {
      tableName: "ga_material",
      timestamps: false
    }
  );

  GaMaterial.associate = (models) => {
    GaMaterial.hasMany(models.GaLocalVisual, {
      foreignKey: "ground_material_id",
      as: "localVisuals"
    });
  };

  return GaMaterial;
};
