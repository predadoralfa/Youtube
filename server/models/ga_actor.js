// server/models/ga_actor.js
module.exports = (sequelize, DataTypes) => {
  const GaActor = sequelize.define(
    "GaActor",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },

      actor_type: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },

      // ⚠️ deve casar com ga_instance.id (no teu DB é INT)
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
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      pos_y: {
        type: DataTypes.INTEGER,
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
    },
    {
      tableName: "ga_actor",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["instance_id"] },
        { fields: ["actor_type"] },
        { fields: ["status"] },
      ],
    }
  );

  GaActor.associate = (models) => {
    GaActor.belongsTo(models.GaInstance, {
      foreignKey: "instance_id",
      as: "instance",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  };

  return GaActor;
};