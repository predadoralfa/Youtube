"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const rows = await queryInterface.sequelize.query(
      `
        SELECT code
        FROM ga_container_def
        WHERE code IN ('HAND_L', 'HAND_R')
      `,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const existingCodes = new Set(rows.map((row) => String(row.code)));
    const toInsert = [];

    if (!existingCodes.has("HAND_L")) {
      toInsert.push({
        code: "HAND_L",
        name: "Hand Left",
        slot_count: 1,
        max_weight: null,
        allowed_categories_mask: null,
        is_active: true,
      });
    }

    if (!existingCodes.has("HAND_R")) {
      toInsert.push({
        code: "HAND_R",
        name: "Hand Right",
        slot_count: 1,
        max_weight: null,
        allowed_categories_mask: null,
        is_active: true,
      });
    }

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert("ga_container_def", toInsert);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("ga_container_def", {
      code: { [Sequelize.Op.in]: ["HAND_L", "HAND_R"] },
    });
  },
};
