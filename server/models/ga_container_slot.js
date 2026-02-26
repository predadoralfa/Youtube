// server/models/ga_container_slot.js
module.exports = (sequelize, DataTypes) => {
  const GaContainerSlot = sequelize.define(
    "GaContainerSlot",
    {
      user_container_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
        references: { model: "ga_user_container", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      slot_index: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },

      item_instance_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: { model: "ga_item_instance", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      qty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "ga_container_slot",      
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ["user_container_id"] },
        { fields: ["item_instance_id"], unique: true }, // anti-dupe estrutural
      ],
    }
  );

  GaContainerSlot.associate = (models) => {
    GaContainerSlot.belongsTo(models.GaUserContainer, {
      foreignKey: "user_container_id",
      as: "container",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaContainerSlot.belongsTo(models.GaItemInstance, {
      foreignKey: "item_instance_id",
      as: "item",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  };

  return GaContainerSlot;
};