// server/models/ga_user_runtime.js
module.exports = (sequelize, DataTypes) => {
  const GaUserRuntime = sequelize.define(
    "GaUserRuntime",
    {
      user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: "ga_user",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      instance_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ga_instance",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },

      pos_x: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },

      pos_y: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },

      pos_z: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },

      yaw: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      tableName: "ga_user_runtime",
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ["instance_id"] }]
    }
  );

  GaUserRuntime.associate = (models) => {
    GaUserRuntime.belongsTo(models.GaUser, {
      foreignKey: "user_id",
      as: "user"
    });

    GaUserRuntime.belongsTo(models.GaInstance, {
      foreignKey: "instance_id",
      as: "instance"
    });
  };

  return GaUserRuntime;
};
