// server/models/ga_render_material.js
module.exports = (sequelize, DataTypes) => {
  const GaRenderMaterial = sequelize.define(
    "GaRenderMaterial",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },

      code: {
        type: DataTypes.STRING(64),
        allowNull: false
      },

      kind: {
        type: DataTypes.ENUM("color", "texture", "pbr", "shader"),
        allowNull: false,
        defaultValue: "color"
      },

      // Para MVP: "#RRGGBB" (ou "#RRGGBBAA" se você quiser alpha)
      base_color: {
        type: DataTypes.STRING(16),
        allowNull: true
      },

      texture_url: {
        type: DataTypes.STRING(255),
        allowNull: true
      },

      roughness: {
        type: DataTypes.FLOAT,
        allowNull: true
      },

      metalness: {
        type: DataTypes.FLOAT,
        allowNull: true
      }
    },
    {
      tableName: "ga_render_material",
      indexes: [{ unique: true, fields: ["code"] }]
    }
  );

  GaRenderMaterial.associate = (models) => {
    // Um material visual pode ser usado por vários locals (ground, props etc)
    GaRenderMaterial.hasMany(models.GaLocalVisual, {
      foreignKey: "ground_render_material_id",
      as: "locals_as_ground_material",
      constraints: true
    });
  };

  return GaRenderMaterial;
};
