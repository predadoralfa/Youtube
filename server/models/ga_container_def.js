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

      // Limite de peso por container (ex: pouch pequena).
      // Se null, significa "sem limite próprio" (entra no limite global do jogador).
      max_weight: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },

      // Máscara simples para filtrar categorias (opcional no MVP).
      // Você pode manter null por enquanto e validar por regra no servidor.
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
    GaContainerDef.hasMany(models.GaUserContainer, {
      foreignKey: "container_def_id",
      as: "userContainers",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaContainerDef;
};