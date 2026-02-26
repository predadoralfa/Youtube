// server/models/ga_user_container.js
module.exports = (sequelize, DataTypes) => {
  const GaUserContainer = sequelize.define(
    "GaUserContainer",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },

      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_user", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      container_def_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "ga_container_def", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      // ex: HAND_L / HAND_R / BELT / BACKPACK_1
      slot_role: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },

      state: {
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
      tableName: "ga_user_container",      
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["user_id"] },
        { fields: ["container_def_id"] },
        { fields: ["state"] },
        { unique: true, fields: ["user_id", "slot_role"] }, // garante 1 mão esquerda etc
      ],
    }
  );

  GaUserContainer.associate = (models) => {
    GaUserContainer.belongsTo(models.GaUser, {
      foreignKey: "user_id",
      as: "user",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    // ✅ alias CANÔNICO ATUAL = "def"
    GaUserContainer.belongsTo(models.GaContainerDef, {
      foreignKey: "container_def_id",
      as: "def",
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    GaUserContainer.hasMany(models.GaContainerSlot, {
      foreignKey: "user_container_id",
      as: "slots",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaUserContainer;
};