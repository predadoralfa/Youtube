"use strict";

function requiredXp(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const exponent = BigInt(safeLevel - 1);
  const numerator = 100n * (3n ** exponent);
  const denominator = 2n ** exponent;
  return ((numerator + denominator - 1n) / denominator).toString();
}

async function findSkillDefId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_skill_def
    WHERE code = 'SKILL_GATHERING'
    LIMIT 1
    `,
    { transaction }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

async function upsertLevel(queryInterface, transaction, skillDefId, level) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_skill_level_def
    WHERE skill_def_id = :skillDefId
      AND level = :level
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        skillDefId,
        level,
      },
    }
  );

  const payload = {
    skill_def_id: skillDefId,
    level,
    required_xp: requiredXp(level),
    title: level === 1 ? "First Steps" : `Level ${level}`,
    description: level === 1 ? "Begin this profession." : "Advance this profession.",
    grants_json: JSON.stringify({ unlock: [] }),
    bonuses_json: null,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_skill_level_def", payload, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert("ga_skill_level_def", [payload], { transaction });
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const skillDefId = await findSkillDefId(queryInterface, transaction);
      if (!skillDefId) throw new Error("Nao foi possivel localizar SKILL_GATHERING.");

      await queryInterface.bulkUpdate(
        "ga_skill_def",
        {
          max_level: 100,
          is_active: true,
        },
        { id: skillDefId },
        { transaction }
      );

      for (let level = 1; level <= 100; level += 1) {
        await upsertLevel(queryInterface, transaction, skillDefId, level);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const skillDefId = await findSkillDefId(queryInterface, transaction);
      if (!skillDefId) return;

      await queryInterface.sequelize.query(
        `
        DELETE FROM ga_skill_level_def
        WHERE skill_def_id = :skillDefId
          AND level > 50
        `,
        {
          transaction,
          replacements: { skillDefId },
        }
      ).catch(() => {});

      await queryInterface.bulkUpdate(
        "ga_skill_def",
        {
          max_level: 50,
        },
        { id: skillDefId },
        { transaction }
      );
    });
  },
};
