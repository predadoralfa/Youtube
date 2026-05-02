"use strict";

function parseJsonObject(value) {
  if (value == null) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyDataJson(data) {
  return JSON.stringify(data ?? {});
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `
        SELECT ic.id, ic.data_json, idf.code AS item_code
        FROM ga_item_def_component ic
        INNER JOIN ga_item_def idf ON idf.id = ic.item_def_id
        WHERE UPPER(ic.component_type) = 'GRANTS_CONTAINER'
          AND idf.code IN ('BASKET', 'BASKET_T2', 'BASKET_T3', 'BASKET_T4')
        `,
        { transaction }
      );

      const slotCountByCode = {
        BASKET: 1,
        BASKET_T2: 1,
        BASKET_T3: 2,
        BASKET_T4: 2,
      };

      for (const row of rows ?? []) {
        const itemCode = String(row?.item_code ?? "").toUpperCase();
        const slotCount = slotCountByCode[itemCode];
        if (!slotCount) continue;

        const data = parseJsonObject(row?.data_json);
        const next = {
          ...data,
          slotCount,
        };

        await queryInterface.bulkUpdate(
          "ga_item_def_component",
          {
            data_json: stringifyDataJson(next),
          },
          {
            id: row.id,
          },
          { transaction }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `
        SELECT ic.id, ic.data_json, idf.code AS item_code
        FROM ga_item_def_component ic
        INNER JOIN ga_item_def idf ON idf.id = ic.item_def_id
        WHERE UPPER(ic.component_type) = 'GRANTS_CONTAINER'
          AND idf.code IN ('BASKET', 'BASKET_T2', 'BASKET_T3', 'BASKET_T4')
        `,
        { transaction }
      );

      for (const row of rows ?? []) {
        const data = parseJsonObject(row?.data_json);
        if (!Object.prototype.hasOwnProperty.call(data, "slotCount")) continue;

        const next = { ...data };
        delete next.slotCount;

        await queryInterface.bulkUpdate(
          "ga_item_def_component",
          {
            data_json: stringifyDataJson(next),
          },
          {
            id: row.id,
          },
          { transaction }
        );
      }
    });
  },
};
