"use strict";

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_item_def_component
        MODIFY COLUMN component_type
        ENUM('EDIBLE', 'CONSUMABLE', 'EQUIPPABLE', 'GRANTS_CONTAINER', 'WEAPON', 'ARMOR', 'TOOL')
        NOT NULL
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE ga_item_def_component component
        INNER JOIN ga_item_def item_def
          ON item_def.id = component.item_def_id
        SET component.component_type = 'EDIBLE'
        WHERE item_def.code = 'FOOD-APPLE'
          AND component.component_type = 'CONSUMABLE'
        `,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_item_def_component component
        INNER JOIN ga_item_def item_def
          ON item_def.id = component.item_def_id
        SET component.component_type = 'CONSUMABLE'
        WHERE item_def.code = 'FOOD-APPLE'
          AND component.component_type = 'EDIBLE'
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_item_def_component
        MODIFY COLUMN component_type
        ENUM('CONSUMABLE', 'EQUIPPABLE', 'GRANTS_CONTAINER', 'WEAPON', 'ARMOR', 'TOOL')
        NOT NULL
        `,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
