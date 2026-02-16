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

      local_type: {
        type: DataTypes.ENUM("UNIVERSO", "PLANETA", "SETOR", "CIDADE", "LOCAL"),
        allowNull: false,
      },

      parent_id: {
        type: DataTypes.INTEGER,
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

      // espelha o MySQL: created_at / updated_at
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",

      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["parent_id"] }
      ]
    }
  );

  GaLocal.associate = (models) => {
    GaLocal.belongsTo(models.GaLocal, {
      foreignKey: "parent_id",
      as: "parent",
      constraints: true,

      // espelha o MySQL: ON DELETE NO ACTION
      onDelete: "NO ACTION",
      onUpdate: "CASCADE"
    });

    GaLocal.hasMany(models.GaLocal, {
      foreignKey: "parent_id",
      as: "children",
      constraints: true
    });

    GaLocal.hasOne(models.GaLocalGeometry, {
      foreignKey: "local_id",
      as: "geometry",
      constraints: true
    });

    GaLocal.hasOne(models.GaLocalVisual, {
      foreignKey: "local_id",
      as: "visual",
      constraints: true
    });

    GaLocal.hasMany(models.GaInstance, {
      foreignKey: "local_id",
      as: "instances",
      constraints: true
    });
  };

  return GaLocal;
};
