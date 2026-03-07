module.exports = (sequelize, DataTypes) => {
    const GaEnemyInstanceStats = sequelize.define(
      "GaEnemyInstanceStats",
      {
        enemy_instance_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          references: {
            model: "ga_enemy_instance",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
  
        hp_current: {
          type: DataTypes.INTEGER,
          allowNull: false,
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
      },
      {
        tableName: "ga_enemy_instance_stats",
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ["hp_current"] }
        ],
      }
    );
  
    GaEnemyInstanceStats.associate = (models) => {
      GaEnemyInstanceStats.belongsTo(models.GaEnemyInstance, {
        foreignKey: "enemy_instance_id",
        as: "enemyInstance",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    };
  
    return GaEnemyInstanceStats;
  };