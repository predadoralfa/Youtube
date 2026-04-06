"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [[eraRow]] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_era_def
        WHERE order_index = 1
        LIMIT 1
        `,
        { transaction }
      );

      const eraMinId = Number(eraRow?.id ?? 0);
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 em ga_era_def.");
      }

      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'WEAPON-STONE-SLING'
        LIMIT 1
        `,
        { transaction }
      );

      let itemDefId = itemRows?.[0]?.id ?? null;

      if (!itemDefId) {
        await queryInterface.bulkInsert(
          "ga_item_def",
          [
            {
              code: "WEAPON-STONE-SLING",
              name: "Thrown Stone",
              category: "EQUIP",
              stack_max: 1,
              unit_weight: 1.2,
              era_min_id: eraMinId,
              is_active: true,
            },
          ],
          { transaction }
        );

        const [insertedRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_item_def
          WHERE code = 'WEAPON-STONE-SLING'
          LIMIT 1
          `,
          { transaction }
        );

        itemDefId = insertedRows?.[0]?.id ?? null;
      } else {
        await queryInterface.bulkUpdate(
          "ga_item_def",
          {
            name: "Thrown Stone",
            category: "EQUIP",
            stack_max: 1,
            unit_weight: 1.2,
            era_min_id: eraMinId,
            is_active: true,
          },
          { id: itemDefId },
          { transaction }
        );
      }

      if (!itemDefId) {
        throw new Error("Nao foi possivel localizar ga_item_def WEAPON-STONE-SLING.");
      }

      const equippableData = JSON.stringify({
        allowedSlots: ["HAND_L", "HAND_R"],
      });

      const weaponData = JSON.stringify({
        weaponClass: "RANGED_THROWN",
        attackPower: 7,
        attackRange: 3,
        durabilityMax: 100,
        ammoType: "STONE",
      });

      const [componentRows] = await queryInterface.sequelize.query(
        `
        SELECT id, component_type
        FROM ga_item_def_component
        WHERE item_def_id = ${Number(itemDefId)}
          AND component_type IN ('EQUIPPABLE', 'WEAPON')
        `,
        { transaction }
      );

      const equippableComponent = componentRows.find(
        (row) => String(row.component_type) === "EQUIPPABLE"
      );
      const weaponComponent = componentRows.find(
        (row) => String(row.component_type) === "WEAPON"
      );

      if (equippableComponent?.id) {
        await queryInterface.bulkUpdate(
          "ga_item_def_component",
          {
            data_json: equippableData,
            version: 1,
          },
          { id: equippableComponent.id },
          { transaction }
        );
      } else {
        await queryInterface.bulkInsert(
          "ga_item_def_component",
          [
            {
              item_def_id: itemDefId,
              component_type: "EQUIPPABLE",
              data_json: equippableData,
              version: 1,
            },
          ],
          { transaction }
        );
      }

      if (weaponComponent?.id) {
        await queryInterface.bulkUpdate(
          "ga_item_def_component",
          {
            data_json: weaponData,
            version: 1,
          },
          { id: weaponComponent.id },
          { transaction }
        );
      } else {
        await queryInterface.bulkInsert(
          "ga_item_def_component",
          [
            {
              item_def_id: itemDefId,
              component_type: "WEAPON",
              data_json: weaponData,
              version: 1,
            },
          ],
          { transaction }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'WEAPON-STONE-SLING'
        LIMIT 1
        `,
        { transaction }
      );

      const itemDefId = itemRows?.[0]?.id ?? null;
      if (!itemDefId) return;

      await queryInterface.bulkDelete(
        "ga_item_def_component",
        {
          item_def_id: itemDefId,
          component_type: {
            [Sequelize.Op.in]: ["EQUIPPABLE", "WEAPON"],
          },
        },
        { transaction }
      );

      await queryInterface.bulkDelete(
        "ga_item_def",
        {
          id: itemDefId,
          code: "WEAPON-STONE-SLING",
        },
        { transaction }
      );
    });
  },
};
