module.exports = (sequelize, DataTypes) => {
  const GaWorldClock = sequelize.define(
    "GaWorldClock",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      anchor_real_ms: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },

      anchor_world_hours: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },

      time_factor: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 3,
      },
    },
    {
      tableName: "ga_world_clock",
      timestamps: true,
      underscored: true,
    }
  );

  return GaWorldClock;
};
