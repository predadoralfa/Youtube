"use strict";

function tableExists(queryInterface, tableName) {
  return queryInterface
    .describeTable(tableName)
    .then(() => true)
    .catch(() => false);
}

function requiredXp(level) {
  return Math.ceil(100 * Math.pow(1.4, level - 1));
}

async function upsertByCode(queryInterface, transaction, tableName, code, payload) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ${tableName}
    WHERE code = :code
    LIMIT 1
    `,
    {
      transaction,
      replacements: { code },
    }
  );

  const id = Number(rows?.[0]?.id ?? 0) || null;
  if (!id) {
    await queryInterface.bulkInsert(tableName, [{ code, ...payload }], { transaction });
    const [insertedRows] = await queryInterface.sequelize.query(
      `
      SELECT id
      FROM ${tableName}
      WHERE code = :code
      LIMIT 1
      `,
      {
        transaction,
        replacements: { code },
      }
    );

    return Number(insertedRows?.[0]?.id ?? 0) || null;
  }

  await queryInterface.bulkUpdate(tableName, payload, { id }, { transaction });
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
        level: level.level,
      },
    }
  );

  const payload = {
    skill_def_id: skillDefId,
    level: level.level,
    required_xp: requiredXp(level.level),
    title: level.title ?? null,
    description: level.description ?? null,
    grants_json: JSON.stringify(level.grants ?? { unlock: [] }),
    bonuses_json: level.bonuses ? JSON.stringify(level.bonuses) : null,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_skill_level_def", payload, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert("ga_skill_level_def", [payload], { transaction });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      if (!(await tableExists(queryInterface, "ga_skill_def"))) {
        await queryInterface.createTable("ga_skill_def", {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          code: {
            type: Sequelize.STRING(64),
            allowNull: false,
            unique: true,
          },
          name: {
            type: Sequelize.STRING(80),
            allowNull: false,
          },
          description: {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          max_level: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1,
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
        }, { transaction });
        await queryInterface.addIndex("ga_skill_def", ["code"], {
          name: "ga_skill_def_code",
          unique: true,
          transaction,
        });
      }

      if (!(await tableExists(queryInterface, "ga_skill_level_def"))) {
        await queryInterface.createTable("ga_skill_level_def", {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          skill_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_skill_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          level: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
          },
          required_xp: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          title: {
            type: Sequelize.STRING(120),
            allowNull: true,
          },
          description: {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          grants_json: {
            type: Sequelize.JSON,
            allowNull: true,
          },
          bonuses_json: {
            type: Sequelize.JSON,
            allowNull: true,
          },
        }, { transaction });
        await queryInterface.addIndex("ga_skill_level_def", ["skill_def_id", "level"], {
          name: "ga_skill_level_def_skill_level",
          unique: true,
          transaction,
        });
      }

      if (!(await tableExists(queryInterface, "ga_user_skill"))) {
        await queryInterface.createTable("ga_user_skill", {
          id: {
            type: Sequelize.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_user", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          skill_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_skill_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          current_level: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          current_xp: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          total_xp: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        }, { transaction });
        await queryInterface.sequelize.query(`
          ALTER TABLE ga_user_skill
          MODIFY updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP;
        `, { transaction });
        await queryInterface.addIndex("ga_user_skill", ["user_id", "skill_def_id"], {
          name: "ga_user_skill_user_skill",
          unique: true,
          transaction,
        });
      }

      if (!(await tableExists(queryInterface, "ga_craft_def"))) {
        await queryInterface.createTable("ga_craft_def", {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          code: {
            type: Sequelize.STRING(64),
            allowNull: false,
            unique: true,
          },
          name: {
            type: Sequelize.STRING(80),
            allowNull: false,
          },
          description: {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          skill_def_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "ga_skill_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          required_skill_level: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1,
          },
          required_research_def_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: "ga_research_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          required_research_level: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1,
          },
          output_item_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_item_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          output_qty: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1,
          },
          craft_time_ms: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          stamina_cost_total: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          xp_reward: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
        }, { transaction });
        await queryInterface.addIndex("ga_craft_def", ["code"], {
          name: "ga_craft_def_code",
          unique: true,
          transaction,
        });
      }

      if (!(await tableExists(queryInterface, "ga_craft_recipe_item"))) {
        await queryInterface.createTable("ga_craft_recipe_item", {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          craft_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_craft_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          item_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_item_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          quantity: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1,
          },
          role: {
            type: Sequelize.ENUM("INPUT", "CATALYST"),
            allowNull: false,
            defaultValue: "INPUT",
          },
          sort_order: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
        }, { transaction });
        await queryInterface.addIndex("ga_craft_recipe_item", ["craft_def_id"], {
          name: "ga_craft_recipe_item_craft_def",
          transaction,
        });
      }

      if (!(await tableExists(queryInterface, "ga_user_craft_job"))) {
        await queryInterface.createTable("ga_user_craft_job", {
          id: {
            type: Sequelize.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_user", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          craft_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_craft_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          status: {
            type: Sequelize.ENUM("PENDING", "RUNNING", "PAUSED", "COMPLETED", "CANCELLED"),
            allowNull: false,
            defaultValue: "PENDING",
          },
          current_progress_ms: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          stamina_spent: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          started_at_ms: {
            type: Sequelize.BIGINT,
            allowNull: true,
          },
          paused_at_ms: {
            type: Sequelize.BIGINT,
            allowNull: true,
          },
          completed_at_ms: {
            type: Sequelize.BIGINT,
            allowNull: true,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        }, { transaction });
        await queryInterface.sequelize.query(`
          ALTER TABLE ga_user_craft_job
          MODIFY updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP;
        `, { transaction });
        await queryInterface.addIndex("ga_user_craft_job", ["user_id"], {
          name: "ga_user_craft_job_user_id",
          transaction,
        });
        await queryInterface.addIndex("ga_user_craft_job", ["craft_def_id"], {
          name: "ga_user_craft_job_craft_def_id",
          transaction,
        });
      }

      const [skillRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_skill_def
        WHERE code = 'SKILL_CRAFTING'
        LIMIT 1
        `,
        { transaction }
      );

      let skillDefId = Number(skillRows?.[0]?.id ?? 0) || null;
      const skillPayload = {
        name: "Crafting",
        description: "Improve your ability to create useful items.",
        max_level: 10,
        is_active: true,
      };

      if (!skillDefId) {
        await queryInterface.bulkInsert(
          "ga_skill_def",
          [
            {
              code: "SKILL_CRAFTING",
              ...skillPayload,
            },
          ],
          { transaction }
        );

        const [insertedRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_skill_def
          WHERE code = 'SKILL_CRAFTING'
          LIMIT 1
          `,
          { transaction }
        );
        skillDefId = Number(insertedRows?.[0]?.id ?? 0) || null;
      } else {
        await queryInterface.bulkUpdate("ga_skill_def", skillPayload, { id: skillDefId }, { transaction });
      }

      if (!skillDefId) {
        throw new Error("Nao foi possivel seedar SKILL_CRAFTING.");
      }

      const levels = Array.from({ length: 10 }, (_, index) => {
        const level = index + 1;
        return {
          level,
          title: level === 1 ? "First Steps" : `Level ${level}`,
          description:
            level === 1
              ? "Open the first practical path into crafting."
              : "Advance your crafting consistency and precision.",
          grants: { unlock: [] },
        };
      });

      for (const level of levels) {
        await upsertSkillLevel(queryInterface, transaction, skillDefId, level);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete("ga_user_craft_job", {}, { transaction }).catch(() => {});
      await queryInterface.bulkDelete("ga_craft_recipe_item", {}, { transaction }).catch(() => {});
      await queryInterface.bulkDelete("ga_craft_def", {}, { transaction }).catch(() => {});
      await queryInterface.bulkDelete("ga_user_skill", {}, { transaction }).catch(() => {});
      await queryInterface.bulkDelete("ga_skill_level_def", {}, { transaction }).catch(() => {});
      await queryInterface.bulkDelete("ga_skill_def", { code: "SKILL_CRAFTING" }, { transaction }).catch(() => {});

      await queryInterface.dropTable("ga_user_craft_job", { transaction }).catch(() => {});
      await queryInterface.dropTable("ga_craft_recipe_item", { transaction }).catch(() => {});
      await queryInterface.dropTable("ga_craft_def", { transaction }).catch(() => {});
      await queryInterface.dropTable("ga_user_skill", { transaction }).catch(() => {});
      await queryInterface.dropTable("ga_skill_level_def", { transaction }).catch(() => {});
      await queryInterface.dropTable("ga_skill_def", { transaction }).catch(() => {});
    });
  },
};
