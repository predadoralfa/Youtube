"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_equipment_slot_def", "slot_kind", {
      type: Sequelize.ENUM("WEAR", "HAND", "USAGE"),
      allowNull: false,
      defaultValue: "WEAR",
    });

    await queryInterface.sequelize.query(
      `
      UPDATE ga_equipment_slot_def
      SET slot_kind = 'USAGE'
      WHERE code IN ('HAND_L', 'HAND_R')
      `
    );

    await queryInterface.changeColumn("ga_equipment_slot_def", "slot_kind", {
      type: Sequelize.ENUM("WEAR", "USAGE"),
      allowNull: false,
      defaultValue: "WEAR",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_equipment_slot_def", "slot_kind", {
      type: Sequelize.ENUM("WEAR", "HAND", "USAGE"),
      allowNull: false,
      defaultValue: "WEAR",
    });

    await queryInterface.sequelize.query(
      `
      UPDATE ga_equipment_slot_def
      SET slot_kind = 'HAND'
      WHERE code IN ('HAND_L', 'HAND_R')
      `
    );

    await queryInterface.changeColumn("ga_equipment_slot_def", "slot_kind", {
      type: Sequelize.ENUM("WEAR", "HAND"),
      allowNull: false,
      defaultValue: "WEAR",
    });
  },
};
