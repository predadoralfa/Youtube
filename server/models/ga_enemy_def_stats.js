module.exports = (sequelize, DataTypes) => {
    const GaEnemyDefStats = sequelize.define(
      "GaEnemyDefStats",
      {
        enemy_def_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          references: {
            model: "ga_enemy_def",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
  
        hp_max: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
  
        move_speed: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
        },
  
        attack_speed: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
        },

        attack_power: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 5,
        },
      },
      {
        tableName: "ga_enemy_def_stats",
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ["hp_max"] }
        ]
      }
    );
  
    GaEnemyDefStats.associate = (models) => {
      GaEnemyDefStats.belongsTo(models.GaEnemyDef, {
        foreignKey: "enemy_def_id",
        as: "enemyDef",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    };
  
    return GaEnemyDefStats;
  };
