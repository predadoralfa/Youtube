"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `
      INSERT INTO ga_container_def (
        code,
        name,
        slot_count,
        max_weight,
        allowed_categories_mask,
        is_active
      ) VALUES (
        :code,
        :name,
        :slotCount,
        :maxWeight,
        :allowedCategoriesMask,
        :isActive
      )
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        slot_count = VALUES(slot_count),
        max_weight = VALUES(max_weight),
        allowed_categories_mask = VALUES(allowed_categories_mask),
        is_active = VALUES(is_active)
      `,
      {
        replacements: {
          code: "BUILD_MATERIALS",
          name: "Build Materials",
          slotCount: 1,
          maxWeight: null,
          allowedCategoriesMask: null,
          isActive: true,
        },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("ga_container_def", { code: "BUILD_MATERIALS" });
  },
};
