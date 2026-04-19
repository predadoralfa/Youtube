"use strict";

function buildStateJson() {
  return JSON.stringify({
    buildKind: "PRIMITIVE_SHELTER",
    structureName: "Primitive Shelter",
    constructionState: "PLANNED",
    constructionStartedAtMs: null,
    constructionCompletedAtMs: null,
    constructionProgressMs: 0,
    constructionDurationMs: 180000,
    buildRequirements: [
      {
        itemCode: "GRAVETO",
        quantity: 1,
      },
    ],
    buildSkillCode: "SKILL_BUILDING",
    buildXpReward: 50,
    canCancel: true,
    canBuild: true,
    footprint: {
      width: 2.6,
      height: 1.5,
    },
  });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor_def
        WHERE code = 'PRIMITIVE_SHELTER'
        LIMIT 1
        `,
        { transaction }
      );

      const actorDefId = Number(rows?.[0]?.id ?? 0) || null;
      if (!actorDefId) return;

      await queryInterface.bulkUpdate(
        "ga_actor_def",
        {
          default_state_json: buildStateJson(),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        { id: actorDefId },
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor_def
        WHERE code = 'PRIMITIVE_SHELTER'
        LIMIT 1
        `,
        { transaction }
      );

      const actorDefId = Number(rows?.[0]?.id ?? 0) || null;
      if (!actorDefId) return;

      await queryInterface.bulkUpdate(
        "ga_actor_def",
        {
          default_state_json: JSON.stringify({
            buildKind: "PRIMITIVE_SHELTER",
            structureName: "Primitive Shelter",
            constructionState: "PLANNED",
            canCancel: true,
            footprint: {
              width: 2.6,
              height: 1.5,
            },
          }),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        { id: actorDefId },
        { transaction }
      );
    });
  },
};
