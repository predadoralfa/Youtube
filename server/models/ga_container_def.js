// server/models/ga_container_def.js
module.exports = (sequelize, DataTypes) => {
  const GaContainerDef = sequelize.define(
    "GaContainerDef",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      code: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },

      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },

      slot_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      max_weight: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },

      allowed_categories_mask: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_container_def",
      timestamps: false,
      underscored: true,
      indexes: [{ unique: true, fields: ["code"] }],
    }
  );

  GaContainerDef.associate = (models) => {
    // Alias consistente e previsível
    GaContainerDef.hasMany(models.GaContainer, {
      foreignKey: "container_def_id",
      as: "containers",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaContainerDef;
};