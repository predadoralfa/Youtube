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

      hp_current: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      hp_max: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      stamina_current: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      stamina_max: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      hunger_current: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      hunger_max: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      thirst_current: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      thirst_max: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      immunity_current: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      immunity_max: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      disease_level: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      disease_severity: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },

      sleep_current: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      sleep_max: {
        type: DataTypes.DOUBLE.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },

      attack_power: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 10
      },

      defense: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },

      attack_speed: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1
      },

      attack_range: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1
      },

      move_speed: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 5
      },

      collect_cooldown_ms: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 4000,
        comment: "Cooldown em milissegundos entre coletas de actors (ex: BAU)"
      },

      carry_weight: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 20,
        validate: {
          min: 0
        }
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
