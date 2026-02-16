// server/models/ga_mesh_template.js
module.exports = (sequelize, DataTypes) => {
  const GaMeshTemplate = sequelize.define(
    "GaMeshTemplate",
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

      mesh_kind: {
        type: DataTypes.ENUM("primitive", "gltf"),
        allowNull: false,
        defaultValue: "primitive"
      },

      primitive_type: {
        type: DataTypes.ENUM("plane", "box", "sphere", "cylinder"),
        allowNull: true
      },

      gltf_url: {
        type: DataTypes.STRING(255),
        allowNull: true
      },

      default_scale_x: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1
      },

      default_scale_y: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1
      },

      default_scale_z: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1
      }
    },
    {
      tableName: "ga_mesh_template",
      indexes: [{ unique: true, fields: ["code"] }]
    }
  );

  GaMeshTemplate.associate = (models) => {
    // Uma mesh pode ser usada por vários locals (ground mesh etc)
    GaMeshTemplate.hasMany(models.GaLocalVisual, {
      foreignKey: "ground_mesh_id",
      as: "locals_as_ground_mesh",
      constraints: true
    });
  };

  return GaMeshTemplate;
};
