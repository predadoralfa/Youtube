"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'FOOD-APPLE'
        LIMIT 1
        `,
        { transaction }
      );

      let appleItemDefId = itemRows?.[0]?.id ?? null;

      if (!appleItemDefId) {
        await queryInterface.bulkInsert(
          "ga_item_def",
          [
            {
              code: "FOOD-APPLE",
              name: "Apple",
              category: "CONSUMABLE",
              stack_max: 20,
              unit_weight: 0.2,
              era_min_id: null,
              is_active: true,
            },
          ],
          { transaction }
        );

        const [insertedItemRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_item_def
          WHERE code = 'FOOD-APPLE'
          LIMIT 1
          `,
          { transaction }
        );

        appleItemDefId = insertedItemRows?.[0]?.id ?? null;
      }

      if (!appleItemDefId) {
        throw new Error("Nao foi possivel localizar ga_item_def FOOD-APPLE.");
      }

      const [containerDefRows] = await queryInterface.sequelize.query(
        `
        SELECT id, slot_count
        FROM ga_container_def
        WHERE code = 'Stone Container'
        LIMIT 1
        `,
        { transaction }
      );

      const treeContainerDefId = containerDefRows?.[0]?.id ?? null;
      const treeContainerSlotCount = Number(containerDefRows?.[0]?.slot_count ?? 0);

      if (!treeContainerDefId || !Number.isInteger(treeContainerSlotCount) || treeContainerSlotCount < 1) {
        throw new Error("Nao encontrei container def reutilizavel para a arvore.");
      }

      const [existingActorRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor
        WHERE actor_type = 'TREE'
          AND instance_id = 1
          AND pos_x = 24
          AND pos_y = 18
        LIMIT 1
        `,
        { transaction }
      );

      if (existingActorRows?.[0]?.id) {
        return;
      }

      await queryInterface.bulkInsert(
        "ga_actor",
        [
          {
            actor_type: "TREE",
            instance_id: 1,
            pos_x: 24,
            pos_y: 18,
            state_json: JSON.stringify({
              resourceType: "APPLE_TREE",
              visualHint: "TREE",
            }),
            status: "ACTIVE",
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );

      const [actorRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor
        WHERE actor_type = 'TREE'
          AND instance_id = 1
          AND pos_x = 24
          AND pos_y = 18
        ORDER BY id DESC
        LIMIT 1
        `,
        { transaction }
      );

      const treeActorId = actorRows?.[0]?.id ?? null;
      if (!treeActorId) {
        throw new Error("Nao foi possivel localizar a arvore seedada.");
      }

      await queryInterface.bulkInsert(
        "ga_container",
        [
          {
            container_def_id: treeContainerDefId,
            slot_role: "LOOT",
            state: "ACTIVE",
            rev: 1,
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );

      const [containerRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_container
        WHERE container_def_id = ${Number(treeContainerDefId)}
          AND slot_role = 'LOOT'
        ORDER BY id DESC
        LIMIT 1
        `,
        { transaction }
      );

      const treeContainerId = containerRows?.[0]?.id ?? null;
      if (!treeContainerId) {
        throw new Error("Nao foi possivel localizar o container da arvore.");
      }

      await queryInterface.bulkInsert(
        "ga_container_owner",
        [
          {
            container_id: treeContainerId,
            owner_kind: "ACTOR",
            owner_id: treeActorId,
            slot_role: "LOOT",
          },
        ],
        { transaction }
      );

      const emptySlots = Array.from({ length: treeContainerSlotCount }, (_, index) => ({
        container_id: treeContainerId,
        slot_index: index,
        item_instance_id: null,
        qty: 0,
      }));

      await queryInterface.bulkInsert("ga_container_slot", emptySlots, { transaction });

      const [userRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_user
        ORDER BY id ASC
        LIMIT 1
        `,
        { transaction }
      );

      const ownerUserId = userRows?.[0]?.id ?? null;

      if (!ownerUserId) {
        return;
      }

      await queryInterface.bulkInsert(
        "ga_item_instance",
        [
          {
            item_def_id: appleItemDefId,
            owner_user_id: ownerUserId,
            bind_state: "NONE",
            durability: null,
            props_json: JSON.stringify({
              sourceActorId: treeActorId,
              sourceType: "APPLE_TREE",
            }),
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );

      const [itemInstanceRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_instance
        WHERE item_def_id = ${Number(appleItemDefId)}
          AND owner_user_id = ${Number(ownerUserId)}
        ORDER BY id DESC
        LIMIT 1
        `,
        { transaction }
      );

      const appleItemInstanceId = itemInstanceRows?.[0]?.id ?? null;
      if (!appleItemInstanceId) {
        throw new Error("Nao foi possivel localizar a instancia da maca.");
      }

      await queryInterface.bulkUpdate(
        "ga_container_slot",
        {
          item_instance_id: appleItemInstanceId,
          qty: 5,
        },
        {
          container_id: treeContainerId,
          slot_index: 0,
        },
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [actorRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor
        WHERE actor_type = 'TREE'
          AND instance_id = 1
          AND pos_x = 24
          AND pos_y = 18
        `,
        { transaction }
      );

      const actorIds = actorRows.map((row) => row.id);
      if (actorIds.length > 0) {
        const [ownerRows] = await queryInterface.sequelize.query(
          `
          SELECT container_id
          FROM ga_container_owner
          WHERE owner_kind = 'ACTOR'
            AND owner_id IN (${actorIds.map((id) => Number(id)).join(",")})
            AND slot_role = 'LOOT'
          `,
          { transaction }
        );

        const containerIds = ownerRows.map((row) => row.container_id);

        if (containerIds.length > 0) {
          const [slotRows] = await queryInterface.sequelize.query(
            `
            SELECT item_instance_id
            FROM ga_container_slot
            WHERE container_id IN (${containerIds.map((id) => Number(id)).join(",")})
              AND item_instance_id IS NOT NULL
            `,
            { transaction }
          );

          const itemInstanceIds = slotRows
            .map((row) => row.item_instance_id)
            .filter((id) => id != null);

          await queryInterface.bulkDelete(
            "ga_container_slot",
            { container_id: { [Sequelize.Op.in]: containerIds } },
            { transaction }
          );

          await queryInterface.bulkDelete(
            "ga_container_owner",
            { container_id: { [Sequelize.Op.in]: containerIds } },
            { transaction }
          );

          await queryInterface.bulkDelete(
            "ga_container",
            { id: { [Sequelize.Op.in]: containerIds } },
            { transaction }
          );

          if (itemInstanceIds.length > 0) {
            await queryInterface.bulkDelete(
              "ga_item_instance",
              { id: { [Sequelize.Op.in]: itemInstanceIds } },
              { transaction }
            );
          }
        }

        await queryInterface.bulkDelete(
          "ga_actor",
          { id: { [Sequelize.Op.in]: actorIds } },
          { transaction }
        );
      }

      await queryInterface.bulkDelete(
        "ga_item_def",
        { code: "FOOD-APPLE" },
        { transaction }
      );
    });
  },
};
