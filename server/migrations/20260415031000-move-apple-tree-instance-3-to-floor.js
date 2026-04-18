"use strict";

const TREE_INSTANCE_ID = 3;
const TREE_POSITION = { x: 30, y: 0, z: 13 };

async function findTreeActorId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT ar.id
    FROM ga_actor_runtime ar
    INNER JOIN ga_actor_def ad ON ad.id = ar.actor_def_id
    WHERE ar.instance_id = ${TREE_INSTANCE_ID}
      AND ad.code = 'TREE_APPLE'
    ORDER BY ar.id ASC
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0]?.id ?? null;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const actorId = await findTreeActorId(queryInterface, transaction);
      if (!actorId) return;

      await queryInterface.bulkUpdate(
        "ga_actor_runtime",
        {
          pos_x: Number(TREE_POSITION.x),
          pos_y: Number(TREE_POSITION.y),
          pos_z: Number(TREE_POSITION.z),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        { id: actorId },
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const actorId = await findTreeActorId(queryInterface, transaction);
      if (!actorId) return;

      await queryInterface.bulkUpdate(
        "ga_actor_runtime",
        {
          pos_x: 30,
          pos_y: 1,
          pos_z: 12,
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        { id: actorId },
        { transaction }
      );
    });
  },
};
