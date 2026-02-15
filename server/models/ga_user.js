const bcrypt = require("bcrypt");

module.exports = (sequelize, DataTypes) => {
  const GaUser = sequelize.define(
    "GaUser",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },

      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
      },

      senha: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {
      tableName: "ga_user",
      timestamps: true,
      underscored: true,
      hooks: {
        beforeCreate: async (user) => {
          if (!user.senha) return;

          const alreadyHashed =
            user.senha.startsWith("$2a$") ||
            user.senha.startsWith("$2b$") ||
            user.senha.startsWith("$2y$");

          if (alreadyHashed) return;

          const salt = await bcrypt.genSalt(10);
          user.senha = await bcrypt.hash(user.senha, salt);
        },

        beforeUpdate: async (user) => {
          if (!user.changed("senha")) return;
          if (!user.senha) return;

          const alreadyHashed =
            user.senha.startsWith("$2a$") ||
            user.senha.startsWith("$2b$") ||
            user.senha.startsWith("$2y$");

          if (alreadyHashed) return;

          const salt = await bcrypt.genSalt(10);
          user.senha = await bcrypt.hash(user.senha, salt);
        }
      }
    }
  );

  GaUser.associate = (models) => {
    GaUser.hasOne(models.GaUserProfile, {
      foreignKey: "user_id",
      as: "profile",
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    GaUser.hasOne(models.GaUserRuntime, {
      foreignKey: "user_id",
      as: "runtime",
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    GaUser.hasOne(models.GaUserStats, {
      foreignKey: "user_id",
      as: "stats",
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  };

  return GaUser;
};
