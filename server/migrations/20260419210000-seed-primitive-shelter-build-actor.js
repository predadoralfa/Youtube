"use strict";

async function findActorDefId(queryInterface, transaction, code) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_actor_def
    WHERE code = :code
    LIMIT 1
    `,
    {
      transaction,
      replacements: { code },
    }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const existingId = await findActorDefId(queryInterface, transaction, "PRIMITIVE_SHELTER");
      const payload = {
        code: "PRIMITIVE_SHELTER",
        name: "Primitive Shelter",
        actor_kind: "STRUCTURE",
        visual_hint: "SHELTER",
        asset_key: null,
        default_state_json: JSON.stringify({
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
        }),
        default_container_def_id: null,
        is_active: true,
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      };

      if (!existingId) {
        await queryInterface.bulkInsert("ga_actor_def", [payload], { transaction });
        return;
      }

      const updatePayload = { ...payload };
      delete updatePayload.created_at;
      delete updatePayload.updated_at;
      await queryInterface.bulkUpdate("ga_actor_def", updatePayload, { id: existingId }, { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const actorDefId = await findActorDefId(queryInterface, transaction, "PRIMITIVE_SHELTER");
      if (actorDefId) {
        await queryInterface.sequelize.query(
          `
          DELETE ar
          FROM ga_actor_runtime ar
          WHERE ar.actor_def_id = :actorDefId
          `,
          {
            transaction,
            replacements: { actorDefId },
          }
        );

        await queryInterface.sequelize.query(
          `
          DELETE asp
          FROM ga_actor_spawn asp
          WHERE asp.actor_def_id = :actorDefId
          `,
          {
            transaction,
            replacements: { actorDefId },
          }
        );

        await queryInterface.bulkDelete("ga_actor_def", { id: actorDefId }, { transaction });
      }
    });
  },
};
