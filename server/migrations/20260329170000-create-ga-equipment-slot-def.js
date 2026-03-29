"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_equipment_slot_def", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      code: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      name: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },

      slot_kind: {
        type: Sequelize.ENUM("WEAR"),
        allowNull: false,
        defaultValue: "WEAR",
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    });

    await queryInterface.addConstraint("ga_equipment_slot_def", {
      fields: ["code"],
      type: "unique",
      name: "uq_ga_equipment_slot_def_code",
    });

    await queryInterface.bulkInsert("ga_equipment_slot_def", [
      { code: "HEAD", name: "Head", slot_kind: "WEAR", is_active: true },
      { code: "TORSO", name: "Torso", slot_kind: "WEAR", is_active: true },
      { code: "LEGS", name: "Legs", slot_kind: "WEAR", is_active: true },
      { code: "FEET", name: "Feet", slot_kind: "WEAR", is_active: true },
      { code: "HANDS_WEAR", name: "Hands", slot_kind: "WEAR", is_active: true },
      { code: "BACK", name: "Back", slot_kind: "WEAR", is_active: true },
      { code: "BELT", name: "Belt", slot_kind: "WEAR", is_active: true },
      { code: "NECK_1", name: "Neck 1", slot_kind: "WEAR", is_active: true },
      { code: "NECK_2", name: "Neck 2", slot_kind: "WEAR", is_active: true },
      { code: "RING_1", name: "Ring 1", slot_kind: "WEAR", is_active: true },
      { code: "RING_2", name: "Ring 2", slot_kind: "WEAR", is_active: true },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ga_equipment_slot_def");
  },
};
