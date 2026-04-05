module.exports = (sequelize, DataTypes) => {
  const GaWorldMonthDef = sequelize.define(
    "GaWorldMonthDef",
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

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      mood: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },

      season: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },

      order_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },

      days_in_month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_world_month_def",
      timestamps: false,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { unique: true, fields: ["order_index"] },
        { fields: ["is_active"] },
      ],
    }
  );

  return GaWorldMonthDef;
};
