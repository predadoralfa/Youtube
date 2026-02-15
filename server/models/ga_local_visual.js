// server/models/ga_local_visual.js
module.exports = (sequelize, DataTypes) => {
  const GaLocalVisual = sequelize.define(
    "GaLocalVisual",
    {
      local_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: "ga_local",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      ground_material_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ga_material",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      }
    },
    {
      tableName: "ga_local_visual",
      timestamps: false
    }
  );

  GaLocalVisual.associate = (models) => {
    GaLocalVisual.belongsTo(models.GaLocal, {
      foreignKey: "local_id",
      as: "local"
    });

    GaLocalVisual.belongsTo(models.GaMaterial, {
      foreignKey: "ground_material_id",
      as: "groundMaterial"
    });
  };

  return GaLocalVisual;
};
