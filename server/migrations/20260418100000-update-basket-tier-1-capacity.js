"use strict";

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
      const [[eraRow]] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_era_def
        WHERE order_index = 1
        LIMIT 1
        `,
        { transaction }
      );

      const eraMinId = Number(eraRow?.id ?? 0) || null;
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 para atualizar a cesta.");
      }

      const basketItemDefId = await upsertByCode(queryInterface, transaction, "ga_item_def", "BASKET", {
        name: "Basket",
        category: "CONTAINER",
        stack_max: 1,
        unit_weight: 0.3,
        era_min_id: eraMinId,
        is_active: true,
      });

      if (!basketItemDefId) {
        throw new Error("Nao foi possivel atualizar o item BASKET.");
      }

      await upsertComponent(
        queryInterface,
        transaction,
        basketItemDefId,
        "EQUIPPABLE",
        JSON.stringify({ allowedSlots: ["HAND_L", "HAND_R"] })
      );

      await upsertComponent(
        queryInterface,
        transaction,
        basketItemDefId,
        "GRANTS_CONTAINER",
        JSON.stringify({ containerDefCode: "BASKET" })
      );

      await upsertByCode(queryInterface, transaction, "ga_container_def", "BASKET", {
        name: "Basket Pouch",
        slot_count: 1,
        max_weight: 2.5,
        allowed_categories_mask: null,
        is_active: true,
      });
    });
  },

  async down(queryInterface) {
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

      const eraMinId = Number(eraRow?.id ?? 0) || null;
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 para restaurar a cesta.");
      }

      const basketItemDefId = await upsertByCode(queryInterface, transaction, "ga_item_def", "BASKET", {
        name: "Basket",
        category: "CONTAINER",
        stack_max: 1,
        unit_weight: 0.3,
        era_min_id: eraMinId,
        is_active: true,
      });

      if (basketItemDefId) {
        await upsertComponent(
          queryInterface,
          transaction,
          basketItemDefId,
          "EQUIPPABLE",
          JSON.stringify({ allowedSlots: ["HAND_L", "HAND_R"] })
        );

        await upsertComponent(
          queryInterface,
          transaction,
          basketItemDefId,
          "GRANTS_CONTAINER",
          JSON.stringify({ containerDefCode: "BASKET" })
        );
      }

      await upsertByCode(queryInterface, transaction, "ga_container_def", "BASKET", {
        name: "Basket Pouch",
        slot_count: 2,
        max_weight: 10,
        allowed_categories_mask: null,
        is_active: true,
      });
    });
  },
};
