module.exports = (sequelize, DataTypes) => {
    const GaSpawnEntry = sequelize.define(
      "GaSpawnEntry",
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
          onDelete: "CASCADE",
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
          type: DataTypes.ENUM("ACTIVE", "DISABLED"),
          allowNull: false,
          defaultValue: "ACTIVE",
        },
  
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
  
        quantity_min: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
  
        quantity_max: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
  
        alive_limit: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
      },
      {
        tableName: "ga_spawn_entry",
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ["spawn_point_id"] },
          { fields: ["enemy_def_id"] },
          { fields: ["status"] },
        ],
      }
    );
  
    GaSpawnEntry.associate = (models) => {
      GaSpawnEntry.belongsTo(models.GaSpawnPoint, {
        foreignKey: "spawn_point_id",
        as: "spawnPoint",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
  
      GaSpawnEntry.belongsTo(models.GaEnemyDef, {
        foreignKey: "enemy_def_id",
        as: "enemyDef",
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
  
      GaSpawnEntry.hasMany(models.GaEnemyInstance, {
        foreignKey: "spawn_entry_id",
        as: "enemyInstances",
      });
    };
  
    return GaSpawnEntry;
  };