// server/models/ga_local.js
module.exports = (sequelize, DataTypes) => {
  const GaLocal = sequelize.define(
    "GaLocal",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },

      code: {
        type: DataTypes.STRING(48),
        allowNull: false
      },

      name: {
        type: DataTypes.STRING(80),
        allowNull: false
      },

      description: {
        type: DataTypes.STRING(255),
        allowNull: true
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: "ga_local",
      indexes: [{ unique: true, fields: ["code"] }]
    }
  );

  GaLocal.associate = (models) => {
    // 1:1
    GaLocal.hasOne(models.GaLocalGeometry, {
      foreignKey: "local_id",
      as: "geometry"
    });

    // 1:1
    GaLocal.hasOne(models.GaLocalVisual, {
      foreignKey: "local_id",
      as: "visual"
    });

    // 1:N (depende de existir esse model e ter local_id)
    GaLocal.hasMany(models.GaInstance, {
      foreignKey: "local_id",
      as: "instances"
    });
  };

  return GaLocal;
};
