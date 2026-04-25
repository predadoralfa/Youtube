// server/models/ga_instance.js
module.exports = (sequelize, DataTypes) => {
  const GaInstance = sequelize.define(
    "GaInstance",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },

      local_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ga_local",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },

      instance_type: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "LOCAL"
      },

      current_era_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_era_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "ONLINE"
      }
    },
    {
      tableName: "ga_instance",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["local_id"] },
        { fields: ["status"] }
      ]
    }
  );

  GaInstance.associate = (models) => {
    GaInstance.belongsTo(models.GaLocal, {
      foreignKey: "local_id",
      as: "local"
    });

    GaInstance.hasMany(models.GaUserRuntime, {
      foreignKey: "instance_id",
      as: "players"
    });

    GaInstance.belongsTo(models.GaEraDef, {
      foreignKey: "current_era_id",
      as: "currentEra",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaInstance.hasOne(models.GaInstanceSpawnConfig, {
      foreignKey: "instance_id",
      as: "spawnConfig",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaInstance.hasOne(models.GaInstanceResourceConfig, {
      foreignKey: "instance_id",
      as: "resourceConfig",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaInstance.hasMany(models.GaSpawnInstance, {
      foreignKey: "instance_id",
      as: "spawnInstances",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
     
  };

  return GaInstance;
};
