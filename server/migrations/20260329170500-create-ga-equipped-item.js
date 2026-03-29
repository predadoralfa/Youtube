"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_equipped_item", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      owner_kind: {
        type: Sequelize.ENUM("PLAYER"),
        allowNull: false,
      },

      owner_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },

      slot_def_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },

      item_instance_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint("ga_equipped_item", {
      fields: ["slot_def_id"],
      type: "foreign key",
      name: "fk_ga_equipped_item_slot_def_id",
      references: { table: "ga_equipment_slot_def", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint("ga_equipped_item", {
      fields: ["item_instance_id"],
      type: "foreign key",
      name: "fk_ga_equipped_item_item_instance_id",
      references: { table: "ga_item_instance", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint("ga_equipped_item", {
      fields: ["owner_kind", "owner_id", "slot_def_id"],
      type: "unique",
      name: "uq_ga_equipped_item_owner_slot",
    });

    await queryInterface.addConstraint("ga_equipped_item", {
      fields: ["item_instance_id"],
      type: "unique",
      name: "uq_ga_equipped_item_item_instance",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ga_equipped_item");
  },
};
