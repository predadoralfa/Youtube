"use strict";

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

async function upsertByCode(queryInterface, transaction, tableName, code, payload) {
  const id = await findIdByCode(queryInterface, transaction, tableName, code);

  if (!id) {
    await queryInterface.bulkInsert(tableName, [{ code, ...payload }], { transaction });
    return findIdByCode(queryInterface, transaction, tableName, code);
  }

  await queryInterface.bulkUpdate(tableName, payload, { id }, { transaction });
  return id;
}

async function upsertComponent(queryInterface, transaction, itemDefId, componentType, dataJson, version = 1) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_def_component
    WHERE item_def_id = :itemDefId
      AND component_type = :componentType
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        itemDefId,
        componentType,
      },
    }
  );

  const payload = {
    item_def_id: itemDefId,
    component_type: componentType,
    data_json: dataJson,
    version,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_item_def_component", payload, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert("ga_item_def_component", [payload], { transaction });
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const eraRow = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_era_def
        WHERE order_index = 1
        LIMIT 1
        `,
        { transaction }
      );

      const eraMinId = Number(eraRow?.[0]?.[0]?.id ?? 0) || null;
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 para seed da cesta Tier 3.");
      }

      const basketT3ItemDefId = await upsertByCode(queryInterface, transaction, "ga_item_def", "BASKET_T3", {
        name: "Basket Tier 3",
        category: "CONTAINER",
        stack_max: 1,
        unit_weight: 0.3,
        era_min_id: eraMinId,
        is_active: true,
      });

      if (!basketT3ItemDefId) {
        throw new Error("Nao foi possivel seedar o item BASKET_T3.");
      }

      await upsertComponent(
        queryInterface,
        transaction,
        basketT3ItemDefId,
        "EQUIPPABLE",
        JSON.stringify({ allowedSlots: ["HAND_L", "HAND_R"] })
      );

      await upsertComponent(
        queryInterface,
        transaction,
        basketT3ItemDefId,
        "GRANTS_CONTAINER",
        JSON.stringify({ containerDefCode: "BASKET_T3" })
      );

      await upsertByCode(queryInterface, transaction, "ga_container_def", "BASKET_T3", {
        name: "Basket Pouch Tier 3",
        slot_count: 2,
        max_weight: 5,
        allowed_categories_mask: null,
        is_active: true,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const basketT3ItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET_T3");
      if (basketT3ItemDefId) {
        await queryInterface.bulkDelete("ga_item_def_component", { item_def_id: basketT3ItemDefId }, { transaction });
        await queryInterface.bulkDelete("ga_item_def", { id: basketT3ItemDefId }, { transaction });
      }

      await queryInterface.bulkDelete("ga_container_def", { code: "BASKET_T3" }, { transaction });
    });
  },
};
