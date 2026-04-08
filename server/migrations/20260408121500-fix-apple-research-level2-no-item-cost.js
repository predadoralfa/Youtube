"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def rld
        INNER JOIN ga_research_def rd ON rd.id = rld.research_def_id
        SET rld.requirements_json = JSON_OBJECT(
          'requiresLevel', 1,
          'itemCosts', JSON_ARRAY()
        )
        WHERE rd.code = 'RESEARCH_APPLE'
          AND rld.level = 2
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def rld
        INNER JOIN ga_research_def rd ON rd.id = rld.research_def_id
        SET rld.grants_json = JSON_OBJECT(
          'unlock', JSON_ARRAY()
        ),
        rld.title = 'Orchard Study',
        rld.description = 'Prepare the next step of apple research after harvesting.'
        WHERE rd.code = 'RESEARCH_APPLE'
          AND rld.level = 2
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def rld
        INNER JOIN ga_research_def rd ON rd.id = rld.research_def_id
        SET rld.description = 'Unlock eating apples and collecting them from trees.',
            rld.grants_json = JSON_OBJECT(
              'unlock', JSON_ARRAY(
                'item.consume:FOOD-APPLE',
                'macro.auto_food:FOOD-APPLE',
                'actor.collect:APPLE_TREE'
              )
            )
        WHERE rd.code = 'RESEARCH_APPLE'
          AND rld.level = 1
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def rld
        INNER JOIN ga_research_def rd ON rd.id = rld.research_def_id
        SET rld.requirements_json = JSON_OBJECT(
          'requiresLevel', 1,
          'itemCosts', JSON_ARRAY(
            JSON_OBJECT('itemCode', 'FOOD-APPLE', 'qty', 30)
          )
        )
        WHERE rd.code = 'RESEARCH_APPLE'
          AND rld.level = 2
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def rld
        INNER JOIN ga_research_def rd ON rd.id = rld.research_def_id
        SET rld.grants_json = JSON_OBJECT(
              'unlock', JSON_ARRAY('actor.collect:APPLE_TREE')
            ),
            rld.title = 'Tree Harvesting',
            rld.description = 'Unlock collecting apples from trees.'
        WHERE rd.code = 'RESEARCH_APPLE'
          AND rld.level = 2
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def rld
        INNER JOIN ga_research_def rd ON rd.id = rld.research_def_id
        SET rld.description = 'Unlock eating apples.',
            rld.grants_json = JSON_OBJECT(
              'unlock', JSON_ARRAY(
                'item.consume:FOOD-APPLE',
                'macro.auto_food:FOOD-APPLE'
              )
            )
        WHERE rd.code = 'RESEARCH_APPLE'
          AND rld.level = 1
        `,
        { transaction }
      );
    });
  },
};
