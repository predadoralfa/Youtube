"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "ga_actor",
      {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },

        // Ex: "CHEST", "TREE", "HERB_NODE", "NPC"
        actor_type: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },

        // ⚠️ Precisa casar com o tipo de ga_instance.id (no teu DB é INT)
        instance_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "ga_instance",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },

        pos_x: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        pos_y: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        state_json: {
          type: Sequelize.JSON,
          allowNull: true,
        },

        status: {
          type: Sequelize.ENUM("ACTIVE", "DISABLED"),
          allowNull: false,
          defaultValue: "ACTIVE",
        },

        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },

        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      },
      {
        engine: "InnoDB",
        charset: "utf8mb4",
        collate: "utf8mb4_general_ci",
      }
    );

    await queryInterface.addIndex("ga_actor", ["instance_id"], {
      name: "ga_actor_instance_id",
    });

    await queryInterface.addIndex("ga_actor", ["actor_type"], {
      name: "ga_actor_actor_type",
    });

    await queryInterface.addIndex("ga_actor", ["status"], {
      name: "ga_actor_status",
    });

    // Auto-update do updated_at no MySQL
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_actor
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ga_actor");
  },
};