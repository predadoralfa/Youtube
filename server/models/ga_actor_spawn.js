"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaActorSpawn = sequelize.define(
    "GaActorSpawn",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      instance_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      actor_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      pos_x: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      pos_y: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      pos_z: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      state_override_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      rev: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "ga_actor_spawn",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["instance_id"] },
        { fields: ["actor_def_id"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaActorSpawn.associate = (models) => {
    GaActorSpawn.belongsTo(models.GaInstance, {
      foreignKey: "instance_id",
      as: "instance",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    GaActorSpawn.belongsTo(models.GaActorDef, {
      foreignKey: "actor_def_id",
      as: "actorDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaActorSpawn.hasMany(models.GaActorRuntime, {
      foreignKey: "actor_spawn_id",
      as: "runtimeActors",
    });
  };

  return GaActorSpawn;
};
