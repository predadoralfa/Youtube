"use strict";

module.exports = {
  async up(queryInterface) {
    const t = await queryInterface.sequelize.transaction();

    try {
      // --------------------------------------------------
      // 1) Garante que instance 6 existe
      // --------------------------------------------------
      const [instRows] = await queryInterface.sequelize.query(
        `SELECT id FROM ga_instance WHERE id = 6 LIMIT 1`,
        { transaction: t }
      );

      if (!instRows.length) {
        throw new Error("Seed requires ga_instance id=6 to exist");
      }

      // --------------------------------------------------
      // 2) Garante container_def CHEST_10
      // --------------------------------------------------
      const [defRowsInitial] = await queryInterface.sequelize.query(
        `SELECT id, slot_count FROM ga_container_def WHERE code = 'CHEST_10' LIMIT 1`,
        { transaction: t }
      );

      if (!defRowsInitial.length) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO ga_container_def
            (code, name, slot_count, max_weight, allowed_categories_mask, is_active)
          VALUES
            ('CHEST_10', 'Baú 10 Slots', 10, NULL, NULL, 1)
          `,
          { transaction: t }
        );
      }

      // resolve sempre após possível insert
      const [defRows] = await queryInterface.sequelize.query(
        `SELECT id, slot_count FROM ga_container_def WHERE code = 'CHEST_10' LIMIT 1`,
        { transaction: t }
      );

      const containerDefId = defRows[0]?.id;
      const slotCount = Number(defRows[0]?.slot_count || 0);

      if (!containerDefId) {
        throw new Error("Failed to resolve CHEST_10 container_def");
      }

      // --------------------------------------------------
      // 3) Evita duplicação
      // --------------------------------------------------
      const [existingActor] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor
        WHERE actor_type = 'CHEST'
          AND instance_id = 6
          AND pos_x = 10
          AND pos_y = 10
        LIMIT 1
        `,
        { transaction: t }
      );

      if (existingActor.length) {
        await t.commit();
        return;
      }

      // --------------------------------------------------
      // 4) Cria Actor
      // --------------------------------------------------
      await queryInterface.sequelize.query(
        `
        INSERT INTO ga_actor
          (actor_type, instance_id, pos_x, pos_y, state_json, status, created_at, updated_at)
        VALUES
          ('CHEST', 6, 10, 10, NULL, 'ACTIVE', NOW(), NOW())
        `,
        { transaction: t }
      );

      const [actorRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor
        WHERE actor_type = 'CHEST'
          AND instance_id = 6
          AND pos_x = 10
          AND pos_y = 10
        ORDER BY id DESC
        LIMIT 1
        `,
        { transaction: t }
      );

      const actorId = actorRows[0]?.id;
      if (!actorId) {
        throw new Error("Failed to resolve created actor id");
      }

      // --------------------------------------------------
      // 5) Cria Container
      // --------------------------------------------------
      await queryInterface.sequelize.query(
        `
        INSERT INTO ga_container
          (container_def_id, state, rev, created_at, updated_at)
        VALUES
          (?, 'ACTIVE', 1, NOW(), NOW())
        `,
        {
          replacements: [containerDefId],
          transaction: t,
        }
      );

      const [containerIdRows] = await queryInterface.sequelize.query(
        `SELECT LAST_INSERT_ID() AS id`,
        { transaction: t }
      );

      const containerId = containerIdRows[0]?.id;
      if (!containerId) {
        throw new Error("Failed to resolve container id");
      }

      // --------------------------------------------------
      // 6) Ownership ACTOR -> Container
      // --------------------------------------------------
      await queryInterface.sequelize.query(
        `
        INSERT INTO ga_container_owner
          (container_id, owner_kind, owner_id, slot_role)
        VALUES
          (?, 'ACTOR', ?, 'LOOT')
        `,
        {
          replacements: [containerId, actorId],
          transaction: t,
        }
      );

      // --------------------------------------------------
      // 7) Slots vazios
      // --------------------------------------------------
      for (let i = 0; i < slotCount; i++) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO ga_container_slot
            (container_id, slot_index, item_instance_id, qty)
          VALUES
            (?, ?, NULL, 0)
          `,
          {
            replacements: [containerId, i],
            transaction: t,
          }
        );
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();

    try {
      const [actorRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor
        WHERE actor_type = 'CHEST'
          AND instance_id = 6
          AND pos_x = 10
          AND pos_y = 10
        LIMIT 1
        `,
        { transaction: t }
      );

      const actorId = actorRows[0]?.id;
      if (!actorId) {
        await t.commit();
        return;
      }

      const [ownerRows] = await queryInterface.sequelize.query(
        `
        SELECT container_id
        FROM ga_container_owner
        WHERE owner_kind='ACTOR'
          AND owner_id=?
          AND slot_role='LOOT'
        LIMIT 1
        `,
        { replacements: [actorId], transaction: t }
      );

      const containerId = ownerRows[0]?.container_id;

      if (containerId) {
        await queryInterface.sequelize.query(
          `DELETE FROM ga_container_slot WHERE container_id = ?`,
          { replacements: [containerId], transaction: t }
        );

        await queryInterface.sequelize.query(
          `DELETE FROM ga_container_owner WHERE container_id = ?`,
          { replacements: [containerId], transaction: t }
        );

        await queryInterface.sequelize.query(
          `DELETE FROM ga_container WHERE id = ?`,
          { replacements: [containerId], transaction: t }
        );
      }

      await queryInterface.sequelize.query(
        `DELETE FROM ga_actor WHERE id = ?`,
        { replacements: [actorId], transaction: t }
      );

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};