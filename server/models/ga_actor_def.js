"use strict";

module.exports = (sequelize, DataTypes) => {
  const GaActorDef = sequelize.define(
    "GaActorDef",
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
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      actor_kind: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      visual_hint: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      asset_key: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      default_state_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      default_container_def_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "ga_actor_def",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["actor_kind"] },
        { fields: ["asset_key"] },
        { fields: ["is_active"] },
      ],
    }
  );

  GaActorDef.associate = (models) => {
    GaActorDef.belongsTo(models.GaContainerDef, {
      foreignKey: "default_container_def_id",
      as: "defaultContainerDef",
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    GaActorDef.hasMany(models.GaActorSpawn, {
      foreignKey: "actor_def_id",
      as: "spawns",
    });

    GaActorDef.hasMany(models.GaActorRuntime, {
      foreignKey: "actor_def_id",
      as: "runtimeActors",
    });
  };

  return GaActorDef;
};
