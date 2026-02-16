// server/models/ga_user_stats.js
module.exports = (sequelize, DataTypes) => {
  const GaUserStats = sequelize.define(
    "GaUserStats",
    {
      user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: "ga_user",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      move_speed: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 2.7778 / 2
      }
    },
    {
      tableName: "ga_user_stats",
      timestamps: true,
      underscored: true
    }
  );

  GaUserStats.associate = (models) => {
    GaUserStats.belongsTo(models.GaUser, {
      foreignKey: "user_id",
      as: "user"
    });
  };

  return GaUserStats;
};
