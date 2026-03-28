module.exports = (sequelize, DataTypes) => {
    const GaSpawnPoint = sequelize.define(
      "GaSpawnPoint",
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
  
        instance_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "ga_instance",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
  
        status: {
          type: DataTypes.ENUM("ACTIVE", "DISABLED"),
          allowNull: false,
          defaultValue: "ACTIVE",
        },
  
        spawn_kind: {
          type: DataTypes.ENUM("ENEMY"),
          allowNull: false,
          defaultValue: "ENEMY",
        },
  
        shape_kind: {
          type: DataTypes.ENUM("POINT", "CIRCLE"),
          allowNull: false,
          defaultValue: "POINT",
        },
  
        pos_x: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
        },
  
        pos_z: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
        },
  
        radius: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: true,
        },

        patrol_radius: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
          defaultValue: 5,
        },

        patrol_wait_ms: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 10000,
        },

        patrol_stop_radius: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
          defaultValue: 0.5,
        },

        max_alive: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
  
        respawn_ms: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 30000,
        },
      },
      {
        tableName: "ga_spawn_point",
        timestamps: true,
        underscored: true,
        indexes: [
          { fields: ["instance_id"] },
          { fields: ["status"] },
        ],
      }
    );
  
    GaSpawnPoint.associate = (models) => {
      GaSpawnPoint.belongsTo(models.GaInstance, {
        foreignKey: "instance_id",
        as: "instance",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
  
      GaSpawnPoint.hasMany(models.GaSpawnEntry, {
        foreignKey: "spawn_point_id",
        as: "entries",
      });
  
      GaSpawnPoint.hasMany(models.GaEnemyInstance, {
        foreignKey: "spawn_point_id",
        as: "enemyInstances",
      });
    };
  
    return GaSpawnPoint;
  };
