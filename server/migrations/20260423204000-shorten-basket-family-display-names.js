"use strict";

async function updateByCode(queryInterface, transaction, tableName, code, payload) {
  await queryInterface.bulkUpdate(tableName, payload, { code }, { transaction });
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await updateByCode(queryInterface, transaction, "ga_container_def", "BASKET", {
        name: "Basket",
      });
      await updateByCode(queryInterface, transaction, "ga_container_def", "BASKET_T2", {
        name: "Basket T2",
      });
      await updateByCode(queryInterface, transaction, "ga_container_def", "BASKET_T3", {
        name: "Basket T3",
      });

      await updateByCode(queryInterface, transaction, "ga_item_def", "BASKET_T2", {
        name: "Basket T2",
      });
      await updateByCode(queryInterface, transaction, "ga_item_def", "BASKET_T3", {
        name: "Basket T3",
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await updateByCode(queryInterface, transaction, "ga_container_def", "BASKET", {
        name: "Basket Pouch",
      });
      await updateByCode(queryInterface, transaction, "ga_container_def", "BASKET_T2", {
        name: "Basket Pouch Tier 2",
      });
      await updateByCode(queryInterface, transaction, "ga_container_def", "BASKET_T3", {
        name: "Basket Pouch Tier 3",
      });

      await updateByCode(queryInterface, transaction, "ga_item_def", "BASKET_T2", {
        name: "Basket Tier 2",
      });
      await updateByCode(queryInterface, transaction, "ga_item_def", "BASKET_T3", {
        name: "Basket Tier 3",
      });
    });
  },
};
