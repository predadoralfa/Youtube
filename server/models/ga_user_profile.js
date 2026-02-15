module.exports = (sequelize, DataTypes) => {
  const GaUserProfile = sequelize.define(
    "GaUserProfile",
    {
      user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: "ga_user",
          key: "id",
        },
      },

      display_name: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
    },
    {
      tableName: "ga_user_profile",
      timestamps: false, // coloque true se você tiver created_at/updated_at
      indexes: [{ unique: true, fields: ["display_name"] }],
      underscored: true, // opcional, mas combina com user_id/display_name
    }
  );

  GaUserProfile.associate = (models) => {
    GaUserProfile.belongsTo(models.GaUser, {
      foreignKey: "user_id",
      as: "user",
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  };

  return GaUserProfile;
};
