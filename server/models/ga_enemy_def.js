module.exports = (sequelize, DataTypes) => {
    const GaEnemyDef = sequelize.define(
      "GaEnemyDef",
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
          type: DataTypes.STRING(120),
          allowNull: false,
        },
  
        status: {
          type: DataTypes.ENUM("ACTIVE", "DISABLED"),
          allowNull: false,
          defaultValue: "ACTIVE",
        },
  
        visual_kind: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: "DEFAULT",
        },

        asset_key: {
          type: DataTypes.STRING(128),
          allowNull: true,
        },

        visual_scale: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
          defaultValue: 1.0,
        },

        collision_radius: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: false,
          defaultValue: 0.5,
        },
  
        ai_profile_json: {
          type: DataTypes.JSON,
          allowNull: true,
        },
  
        flags_json: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
      {
        tableName: "ga_enemy_def",
        timestamps: true,
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ["code"],
          },
          {
            fields: ["status"],
          },
          {
            fields: ["visual_kind"],
          },
          {
            fields: ["asset_key"],
          },
          {
            fields: ["visual_scale"],
          },
        ],
      }
    );
  
    GaEnemyDef.associate = (models) => {
      GaEnemyDef.hasOne(models.GaEnemyDefStats, {
        foreignKey: "enemy_def_id",
        as: "baseStats",
      });
  
      GaEnemyDef.hasMany(models.GaSpawnDefEnemy, {
        foreignKey: "enemy_def_id",
        as: "spawnDefEnemies",
      });
    };
  
    return GaEnemyDef;
  };
