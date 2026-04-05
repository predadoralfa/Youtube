"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_item_def
        MODIFY COLUMN category ENUM('CONSUMABLE', 'FOOD', 'EQUIP', 'AMMO', 'MATERIAL', 'QUEST', 'CONTAINER', 'MISC')
        NOT NULL DEFAULT 'MISC'
        `,
        { transaction: t }
      );

      await queryInterface.bulkUpdate(
        "ga_item_def",
        { category: "FOOD" },
        { code: "FOOD-APPLE" },
        { transaction: t }
      );

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_item_def
        SET category = 'CONSUMABLE'
        WHERE category = 'FOOD'
        `,
        { transaction: t }
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_item_def
        MODIFY COLUMN category ENUM('CONSUMABLE', 'EQUIP', 'AMMO', 'MATERIAL', 'QUEST', 'CONTAINER', 'MISC')
        NOT NULL DEFAULT 'MISC'
        `,
        { transaction: t }
      );

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
