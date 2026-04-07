"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaActorRuntime = sequelize.define(
    "GaActorRuntime",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      actor_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      actor_spawn_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      instance_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ga_instance",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
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
      state_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      rev: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "ga_actor_runtime",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["actor_def_id"] },
        { fields: ["actor_spawn_id"] },
        { fields: ["instance_id"] },
        { fields: ["status"] },
      ],
    }
  );

  GaActorRuntime.associate = (models) => {
    GaActorRuntime.belongsTo(models.GaActorDef, {
      foreignKey: "actor_def_id",
      as: "actorDef",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaActorRuntime.belongsTo(models.GaActorSpawn, {
      foreignKey: "actor_spawn_id",
      as: "spawn",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    GaActorRuntime.belongsTo(models.GaInstance, {
      foreignKey: "instance_id",
      as: "instance",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaActorRuntime;
};
