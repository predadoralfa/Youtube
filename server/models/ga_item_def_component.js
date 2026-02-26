// server/models/ga_item_def_component.js
module.exports = (sequelize, DataTypes) => {
  const GaItemDefComponent = sequelize.define(
    "GaItemDefComponent",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      item_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_item_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      component_type: {
        type: DataTypes.ENUM(
          "CONSUMABLE",
          "EQUIPPABLE",
          "GRANTS_CONTAINER",
          "WEAPON",
          "ARMOR",
          "TOOL"
        ),
        allowNull: false,
      },

      // JSON pequeno e versionável por componente.
      // Ex consumable: { effects:[{stat:"hp",op:"add",value:50,durationMs:0}] }
      data_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "ga_item_def_component",
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ["item_def_id"] },
        { fields: ["component_type"] },
      ],
    }
  );

  GaItemDefComponent.associate = (models) => {
    GaItemDefComponent.belongsTo(models.GaItemDef, {
      foreignKey: "item_def_id",
      as: "itemDef",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaItemDefComponent;
};