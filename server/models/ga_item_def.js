// server/models/ga_item_def.js
module.exports = (sequelize, DataTypes) => {
  const GaItemDef = sequelize.define(
    "GaItemDef",
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

      category: {
        type: DataTypes.ENUM("CONSUMABLE", "FOOD", "EQUIP", "AMMO", "MATERIAL", "QUEST", "CONTAINER", "MISC"),
        allowNull: false,
        defaultValue: "MISC",
      },

      stack_max: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: 1,
        },
      },

      unit_weight: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },

      era_min_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "ga_era_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_item_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["category"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaItemDef.associate = (models) => {
    GaItemDef.hasMany(models.GaItemDefComponent, {
      foreignKey: "item_def_id",
      as: "components",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaItemDef.hasMany(models.GaItemInstance, {
      foreignKey: "item_def_id",
      as: "instances",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaItemDef.belongsTo(models.GaEraDef, {
      foreignKey: "era_min_id",
      as: "eraMin",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    
  };

  return GaItemDef;
};
