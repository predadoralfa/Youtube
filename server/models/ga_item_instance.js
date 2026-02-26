// server/models/ga_item_instance.js
module.exports = (sequelize, DataTypes) => {
  const GaItemInstance = sequelize.define(
    "GaItemInstance",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },

      item_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_item_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      owner_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_user", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      bind_state: {
        type: DataTypes.ENUM("NONE", "ON_PICKUP", "SOULBOUND"),
        allowNull: false,
        defaultValue: "NONE",
      },

      durability: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      // atributos de instância (rolls etc) sem travar schema
      props_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "ga_item_instance",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["item_def_id"] },
        { fields: ["owner_user_id"] },
        { fields: ["bind_state"] },
      ],
    }
  );

  GaItemInstance.associate = (models) => {
    GaItemInstance.belongsTo(models.GaItemDef, {
      foreignKey: "item_def_id",
      as: "def",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaItemInstance.belongsTo(models.GaUser, {
      foreignKey: "owner_user_id",
      as: "owner",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    // Um item_instance pode estar em 0..1 slots (ou no chão, ou escrow etc no futuro)
    GaItemInstance.hasOne(models.GaContainerSlot, {
      foreignKey: "item_instance_id",
      as: "slot",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  };

  return GaItemInstance;
};