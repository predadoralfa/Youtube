// server/models/ga_local_visual.js
module.exports = (sequelize, DataTypes) => {
  const GaLocalVisual = sequelize.define(
    "GaLocalVisual",
    {
      // Mantém 1:1 com ga_local
      local_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
      },

      // NOVO: ground mesh declarativa
      ground_mesh_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },

      // NOVO: material visual (separado do físico)
      ground_render_material_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },

      // Para cache/versionamento do template visual do local
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      }
    },
    {
      tableName: "ga_local_visual",
      indexes: [
        { unique: true, fields: ["local_id"] },
        { fields: ["ground_mesh_id"] },
        { fields: ["ground_render_material_id"] }
      ]
    }
  );

  GaLocalVisual.associate = (models) => {
  // 1:1 com Local
  GaLocalVisual.belongsTo(models.GaLocal, {
    foreignKey: "local_id",
    as: "local",
    constraints: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE"
  });

  // ✅ MATERIAL FÍSICO (ga_material)
  GaLocalVisual.belongsTo(models.GaMaterial, {
    foreignKey: "ground_material_id",
    as: "groundMaterial",
    constraints: true,
    onDelete: "RESTRICT", // espelha o banco
    onUpdate: "CASCADE"
  });

  // FK: ground_mesh_id -> ga_mesh_template.id
  GaLocalVisual.belongsTo(models.GaMeshTemplate, {
    foreignKey: "ground_mesh_id",
    as: "groundMesh",
    constraints: true,
    onDelete: "SET NULL",
    onUpdate: "CASCADE"
  });

  // FK: ground_render_material_id -> ga_render_material.id
  GaLocalVisual.belongsTo(models.GaRenderMaterial, {
    foreignKey: "ground_render_material_id",
    as: "groundRenderMaterial",
    constraints: true,
    onDelete: "SET NULL",
    onUpdate: "CASCADE"
  });
};


  return GaLocalVisual;
};
