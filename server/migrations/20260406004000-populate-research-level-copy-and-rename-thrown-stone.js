"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_item_def",
        { name: "Thrown Stone" },
        { code: "WEAPON-STONE-SLING" },
        { transaction }
      );

      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id, code
        FROM ga_research_def
        WHERE code IN ('RESEARCH_APPLE', 'RESEARCH_STONE', 'RESEARCH_PRIMITIVE_SHELTER')
        `,
        { transaction }
      );

      const researchIdByCode = new Map(
        researchRows.map((row) => [String(row.code), Number(row.id)])
      );

      const updates = [
        {
          code: "RESEARCH_APPLE",
          level: 1,
          title: "Edible Basics",
          description: "Unlock eating apples.",
        },
        {
          code: "RESEARCH_APPLE",
          level: 2,
          title: "Tree Harvesting",
          description: "Unlock collecting apples from trees.",
        },
        {
          code: "RESEARCH_STONE",
          level: 1,
          title: "Primitive Throwing",
          description: "Unlock crafting a hand-thrown stone weapon.",
        },
        {
          code: "RESEARCH_PRIMITIVE_SHELTER",
          level: 1,
          title: "Basic Shelter",
          description: "Unlock the builder screen for a primitive sleeping spot.",
        },
      ];

      for (const update of updates) {
        const researchDefId = researchIdByCode.get(update.code);
        if (!researchDefId) continue;

        await queryInterface.bulkUpdate(
          "ga_research_level_def",
          {
            title: update.title,
            description: update.description,
          },
          {
            research_def_id: researchDefId,
            level: update.level,
          },
          { transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_item_def",
        { name: "Stone Sling" },
        { code: "WEAPON-STONE-SLING" },
        { transaction }
      );

      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id, code
        FROM ga_research_def
        WHERE code IN ('RESEARCH_APPLE', 'RESEARCH_STONE', 'RESEARCH_PRIMITIVE_SHELTER')
        `,
        { transaction }
      );

      const researchIdByCode = new Map(
        researchRows.map((row) => [String(row.code), Number(row.id)])
      );

      const targets = [
        { code: "RESEARCH_APPLE", level: 1 },
        { code: "RESEARCH_APPLE", level: 2 },
        { code: "RESEARCH_STONE", level: 1 },
        { code: "RESEARCH_PRIMITIVE_SHELTER", level: 1 },
      ];

      for (const target of targets) {
        const researchDefId = researchIdByCode.get(target.code);
        if (!researchDefId) continue;

        await queryInterface.bulkUpdate(
          "ga_research_level_def",
          {
            title: null,
            description: null,
          },
          {
            research_def_id: researchDefId,
            level: target.level,
          },
          { transaction }
        );
      }
    });
  },
};
