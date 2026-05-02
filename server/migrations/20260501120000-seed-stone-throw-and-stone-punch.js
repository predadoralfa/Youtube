"use strict";

async function findEra1Id(queryInterface, transaction) {
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

  return eraMinId;
}

async function findItemIdByCode(queryInterface, transaction, code) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_def
    WHERE code = :code
    LIMIT 1
    `,
    { transaction, replacements: { code } }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

async function upsertItemDef(queryInterface, transaction, itemDef) {
  const existingId = await findItemIdByCode(queryInterface, transaction, itemDef.code);

  if (existingId) {
    await queryInterface.bulkUpdate(
      "ga_item_def",
      {
        name: itemDef.name,
        asset_key: itemDef.asset_key,
        category: itemDef.category,
        stack_max: itemDef.stack_max,
        unit_weight: itemDef.unit_weight,
        era_min_id: itemDef.era_min_id,
        is_active: itemDef.is_active,
      },
      { id: existingId },
      { transaction }
    );

    return existingId;
  }

  await queryInterface.bulkInsert(
    "ga_item_def",
    [
      {
        code: itemDef.code,
        name: itemDef.name,
        asset_key: itemDef.asset_key,
        category: itemDef.category,
        stack_max: itemDef.stack_max,
        unit_weight: itemDef.unit_weight,
        era_min_id: itemDef.era_min_id,
        is_active: itemDef.is_active,
      },
    ],
    { transaction }
  );

  return findItemIdByCode(queryInterface, transaction, itemDef.code);
}

async function upsertComponent(queryInterface, transaction, itemDefId, componentType, dataJson) {
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
    data_json: JSON.stringify(dataJson),
    version: 1,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate(
      "ga_item_def_component",
      payload,
      { id: rows[0].id },
      { transaction }
    );
    return;
  }

  await queryInterface.bulkInsert("ga_item_def_component", [payload], { transaction });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const eraMinId = await findEra1Id(queryInterface, transaction);

      const weapons = [
        {
          code: "STONE_THROW",
          name: "Stone Throw",
          asset_key: "Stone.glb",
          category: "EQUIP",
          stack_max: 1,
          unit_weight: 5,
          era_min_id: eraMinId,
          is_active: true,
          equippable: {
            allowedSlots: ["HAND_L", "HAND_R"],
          },
          weapon: {
            weaponClass: "RANGED_THROWN",
            attackPower: 3,
            attackSpeed: 0.15,
            attackRange: 3,
            durabilityMax: 100,
            criticalChance: 0.05,
            criticalMultiplier: null,
            staminaCost: 7,
            damageType: "impacto",
            ammoType: "THROW",
            bonusExtras: {},
            props_json: "arma normal",
          },
        },
        {
          code: "STONE_PUNCH",
          name: "Stone Punch",
          asset_key: "Stone.glb",
          category: "EQUIP",
          stack_max: 1,
          unit_weight: 1,
          era_min_id: eraMinId,
          is_active: true,
          equippable: {
            allowedSlots: ["HAND_L"],
          },
          weapon: {
            weaponClass: "MELEE",
            attackPower: 5,
            attackSpeed: 0.1,
            attackRange: 1,
            durabilityMax: 100,
            criticalChance: 0.07,
            criticalMultiplier: null,
            staminaCost: 10,
            damageType: "impacto",
            bonusExtras: {},
            props_json: "arma normal",
          },
        },
      ];

      for (const weapon of weapons) {
        const itemDefId = await upsertItemDef(queryInterface, transaction, weapon);
        if (!itemDefId) {
          throw new Error(`Nao foi possivel localizar ga_item_def ${weapon.code}.`);
        }

        await upsertComponent(
          queryInterface,
          transaction,
          itemDefId,
          "EQUIPPABLE",
          weapon.equippable
        );

        await upsertComponent(queryInterface, transaction, itemDefId, "WEAPON", weapon.weapon);
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const codes = ["STONE_THROW", "STONE_PUNCH"];

      for (const code of codes) {
        const itemDefId = await findItemIdByCode(queryInterface, transaction, code);
        if (!itemDefId) continue;

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
            code,
          },
          { transaction }
        );
      }
    });
  },
};
