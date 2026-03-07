module.exports = (sequelize, DataTypes) => {
    const GaEnemyInstance = sequelize.define(
      "GaEnemyInstance",
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
  
        spawn_point_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "ga_spawn_point",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
  
        spawn_entry_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "ga_spawn_entry",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
  
        enemy_def_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "ga_enemy_def",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
  
        status: {
          type: DataTypes.ENUM("ALIVE", "DEAD", "DESPAWNED"),
          allowNull: false,
          defaultValue: "ALIVE",
        },
  
        pos_x: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
        },
  
        pos_z: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
        },
  
        yaw: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: true,
        },
  
        home_x: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: true,
        },
  
        home_z: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: true,
        },
  
        spawned_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
  
        dead_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
  
        respawn_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        tableName: "ga_enemy_instance",
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ["instance_id"] },
          { fields: ["spawn_point_id"] },
          { fields: ["status"] },
        ],
      }
    );
  
    GaEnemyInstance.associate = (models) => {  
      GaEnemyInstance.belongsTo(models.GaSpawnPoint, {
        foreignKey: "spawn_point_id",
        as: "spawnPoint",
      });
  
      GaEnemyInstance.belongsTo(models.GaSpawnEntry, {
        foreignKey: "spawn_entry_id",
        as: "spawnEntry",
      });
  
      GaEnemyInstance.belongsTo(models.GaEnemyDef, {
        foreignKey: "enemy_def_id",
        as: "enemyDef",
      });
  
      GaEnemyInstance.hasOne(models.GaEnemyInstanceStats, {
        foreignKey: "enemy_instance_id",
        as: "stats",
      });
    };
  
    return GaEnemyInstance;
  };