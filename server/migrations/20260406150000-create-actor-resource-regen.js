"use strict";

async function findSingleId(queryInterface, transaction, sql) {
  const [rows] = await queryInterface.sequelize.query(sql, { transaction });
  return rows?.[0]?.id ?? null;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "ga_actor_resource_rule_def",
        {
          id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
          },
          code: {
            type: Sequelize.STRING(64),
            allowNull: false,
            unique: true,
          },
          name: {
            type: Sequelize.STRING(128),
            allowNull: false,
          },
          actor_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          container_slot_role: {
            type: Sequelize.STRING(64),
            allowNull: false,
            defaultValue: "LOOT",
          },
          item_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          refill_amount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
          },
          refill_interval_ms: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 300000,
          },
          max_qty: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 15,
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );

      await queryInterface.addIndex("ga_actor_resource_rule_def", ["code"], {
        unique: true,
        name: "ga_actor_resource_rule_def_code",
        transaction,
      });
      await queryInterface.addIndex("ga_actor_resource_rule_def", ["actor_def_id"], {
        name: "ga_actor_resource_rule_def_actor_def_id",
        transaction,
      });
      await queryInterface.addIndex("ga_actor_resource_rule_def", ["item_def_id"], {
        name: "ga_actor_resource_rule_def_item_def_id",
        transaction,
      });
      await queryInterface.addIndex("ga_actor_resource_rule_def", ["is_active"], {
        name: "ga_actor_resource_rule_def_is_active",
        transaction,
      });

      await queryInterface.createTable(
        "ga_actor_resource_state",
        {
          actor_id: {
            type: Sequelize.BIGINT,
            allowNull: false,
            primaryKey: true,
            references: { model: "ga_actor", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          rule_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "ga_actor_resource_rule_def", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          current_qty: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          last_refill_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          next_refill_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          state: {
            type: Sequelize.ENUM("ACTIVE", "PAUSED"),
            allowNull: false,
            defaultValue: "ACTIVE",
          },
          rev: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 1,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );

      await queryInterface.addIndex("ga_actor_resource_state", ["actor_id"], {
        unique: true,
        name: "ga_actor_resource_state_actor_id",
        transaction,
      });
      await queryInterface.addIndex("ga_actor_resource_state", ["rule_def_id"], {
        name: "ga_actor_resource_state_rule_def_id",
        transaction,
      });
      await queryInterface.addIndex("ga_actor_resource_state", ["next_refill_at"], {
        name: "ga_actor_resource_state_next_refill_at",
        transaction,
      });
      await queryInterface.addIndex("ga_actor_resource_state", ["state"], {
        name: "ga_actor_resource_state_state",
        transaction,
      });

      const treeActorDefId = await findSingleId(
        queryInterface,
        transaction,
        `
        SELECT id
        FROM ga_actor_def
        WHERE code = 'TREE_APPLE'
        LIMIT 1
        `
      );
      const appleItemDefId = await findSingleId(
        queryInterface,
        transaction,
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'FOOD-APPLE'
        LIMIT 1
        `
      );

      if (!treeActorDefId || !appleItemDefId) {
        throw new Error("Nao foi possivel seedar a regra TREE_APPLE_REGEN.");
      }

      await queryInterface.sequelize.query(
        `
        INSERT INTO ga_actor_resource_rule_def
          (code, name, actor_def_id, container_slot_role, item_def_id, refill_amount, refill_interval_ms, max_qty, is_active, created_at, updated_at)
        VALUES
          (:code, :name, :actorDefId, :slotRole, :itemDefId, :refillAmount, :refillIntervalMs, :maxQty, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          actor_def_id = VALUES(actor_def_id),
          container_slot_role = VALUES(container_slot_role),
          item_def_id = VALUES(item_def_id),
          refill_amount = VALUES(refill_amount),
          refill_interval_ms = VALUES(refill_interval_ms),
          max_qty = VALUES(max_qty),
          is_active = VALUES(is_active),
          updated_at = CURRENT_TIMESTAMP
        `,
        {
          transaction,
          replacements: {
            code: "TREE_APPLE_REGEN",
            name: "Apple Tree Regen",
            actorDefId: Number(treeActorDefId),
            slotRole: "LOOT",
            itemDefId: Number(appleItemDefId),
            refillAmount: 1,
            refillIntervalMs: 300000,
            maxQty: 15,
          },
        }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE ga_actor_def
        SET visual_hint = 'APPLE_TREE'
        WHERE code = 'TREE_APPLE'
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("ga_actor_resource_state", { transaction });
      await queryInterface.dropTable("ga_actor_resource_rule_def", { transaction });
    });
  },
};
