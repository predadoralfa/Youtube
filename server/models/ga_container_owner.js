// server/models/ga_container_owner.js
module.exports = (sequelize, DataTypes) => {
  const GaContainerOwner = sequelize.define(
    "GaContainerOwner",
    {
      container_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        references: { model: "ga_container", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      owner_kind: {
        type: DataTypes.ENUM("PLAYER", "ACTOR"),
        allowNull: false,
        primaryKey: true,
      },

      owner_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },

      slot_role: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
    },
    {
      tableName: "ga_container_owner",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["container_id"] },
        { fields: ["owner_kind", "owner_id"] },
        { unique: true, fields: ["owner_kind", "owner_id", "slot_role"] },
      ],
    }
  );

  GaContainerOwner.associate = (models) => {
    GaContainerOwner.belongsTo(models.GaContainer, {
      foreignKey: "container_id",
      as: "container",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaContainerOwner;
};