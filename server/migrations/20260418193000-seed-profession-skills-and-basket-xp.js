"use strict";

function requiredXp(level) {
  return Math.ceil(100 * Math.pow(1.5, level - 1));
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
      const skills = [
        {
          code: "SKILL_CRAFTING",
          name: "Crafting",
          description: "Improve your ability to create useful items.",
          maxLevel: 50,
        },
        {
          code: "SKILL_BUILDING",
          name: "Building",
          description: "Improve your ability to build structures and placed objects.",
          maxLevel: 50,
        },
        {
          code: "SKILL_COOKING",
          name: "Cooking",
          description: "Improve your ability to prepare food.",
          maxLevel: 50,
        },
      ];

      for (const skill of skills) {
        const skillDefId = await upsertSkill(queryInterface, transaction, skill);
        if (!skillDefId) throw new Error(`Nao foi possivel seedar ${skill.code}.`);

        for (let level = 1; level <= skill.maxLevel; level += 1) {
          await upsertSkillLevel(queryInterface, transaction, skillDefId, level);
        }
      }

      const craftingSkillDefId = await findIdByCode(queryInterface, transaction, "ga_skill_def", "SKILL_CRAFTING");
      await queryInterface.bulkUpdate(
        "ga_craft_def",
        {
          skill_def_id: craftingSkillDefId,
          required_skill_level: 1,
          xp_reward: 50,
        },
        { code: "CRAFT_BASKET" },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_craft_def",
        {
          xp_reward: 15,
        },
        { code: "CRAFT_BASKET" },
        { transaction }
      );
    });
  },
};
