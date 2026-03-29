"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_equipment_slot_def", "slot_kind", {
      type: Sequelize.ENUM("WEAR", "HAND"),
      allowNull: false,
      defaultValue: "WEAR",
    });

    await queryInterface.bulkInsert("ga_equipment_slot_def", [
      { code: "HAND_L", name: "Hand Left", slot_kind: "HAND", is_active: true },
      { code: "HAND_R", name: "Hand Right", slot_kind: "HAND", is_active: true },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "ga_equipment_slot_def",
      { code: { [Sequelize.Op.in]: ["HAND_L", "HAND_R"] } }
    );

    await queryInterface.changeColumn("ga_equipment_slot_def", "slot_kind", {
      type: Sequelize.ENUM("WEAR"),
      allowNull: false,
      defaultValue: "WEAR",
    });
  },
};
