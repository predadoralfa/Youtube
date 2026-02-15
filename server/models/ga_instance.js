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
  };

  return GaInstance;
};
