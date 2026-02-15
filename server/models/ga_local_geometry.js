// server/models/ga_local_geometry.js
module.exports = (sequelize, DataTypes) => {
  const GaLocalGeometry = sequelize.define(
    "GaLocalGeometry",
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

      size_x: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 200
      },

      size_z: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 200
      }
    },
    {
      tableName: "ga_local_geometry",
      timestamps: false
    }
  );

  GaLocalGeometry.associate = (models) => {
    GaLocalGeometry.belongsTo(models.GaLocal, {
      foreignKey: "local_id",
      as: "local"
    });
  };

  return GaLocalGeometry;
};
