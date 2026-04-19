"use strict";

function requiredXp(level) {
  const exponent = BigInt(Math.max(1, level) - 1);
  const numerator = 100n * (3n ** exponent);
  const denominator = 2n ** exponent;
  return ((numerator + denominator - 1n) / denominator).toString();
}

async function findIdByCode(queryInterface, transaction, tableName, code) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ${tableName}
    WHERE code = :code
    LIMIT 1
    `,
    { transaction, replacements: { code } }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

async function upsertSkill(queryInterface, transaction, skill) {
  const id = await findIdByCode(queryInterface, transaction, "ga_skill_def", skill.code);
  const payload = {
    name: skill.name,
    description: skill.description,
    max_level: skill.maxLevel,
    is_active: true,
  };

  if (!id) {
    await queryInterface.bulkInsert(
      "ga_skill_def",
      [
        {
          code: skill.code,
          ...payload,
        },
      ],
      { transaction }
    );
    return findIdByCode(queryInterface, transaction, "ga_skill_def", skill.code);
  }

  await queryInterface.bulkUpdate("ga_skill_def", payload, { id }, { transaction });
  return id;
}

async function upsertSkillLevel(queryInterface, transaction, skillDefId, level) {
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
    description:
      level === 1
        ? "Begin this profession."
        : "Advance this profession.",
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
      const skill = {
        code: "SKILL_GATHERING",
        name: "Gathering",
        description: "Improve your ability to gather resources from actors.",
        maxLevel: 100,
      };

      const skillDefId = await upsertSkill(queryInterface, transaction, skill);
      if (!skillDefId) throw new Error("Nao foi possivel seedar SKILL_GATHERING.");

      for (let level = 1; level <= skill.maxLevel; level += 1) {
        await upsertSkillLevel(queryInterface, transaction, skillDefId, level);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const skillDefId = await findIdByCode(queryInterface, transaction, "ga_skill_def", "SKILL_GATHERING");

      if (skillDefId) {
        await queryInterface.bulkDelete("ga_skill_level_def", { skill_def_id: skillDefId }, { transaction }).catch(() => {});
        await queryInterface.bulkDelete("ga_user_skill", { skill_def_id: skillDefId }, { transaction }).catch(() => {});
      }

      await queryInterface.bulkDelete("ga_skill_def", { code: "SKILL_GATHERING" }, { transaction }).catch(() => {});
    });
  },
};
