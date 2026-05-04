"use strict";

const SCENE_OBJECT_DEFS = [
  {
    code: "DECOR_ROCK_01",
    name: "Decor Rock 01",
    category: "ROCK",
    asset_key: "ROCK",
    default_state_json: JSON.stringify({
      visualHint: "ROCK",
      family: "DECOR",
    }),
  },
  {
    code: "DECOR_ROCK_02",
    name: "Decor Rock 02",
    category: "ROCK",
    asset_key: "ROCK",
    default_state_json: JSON.stringify({
      visualHint: "ROCK",
      family: "DECOR",
      variant: "02",
    }),
  },
  {
    code: "WOOD_BENCH_01",
    name: "Wood Bench 01",
    category: "FURNITURE",
    asset_key: "WOOD_BENCH_01",
    default_state_json: JSON.stringify({
      visualHint: "BENCH",
      family: "DECOR",
    }),
  },
  {
    code: "LAMP_POST_01",
    name: "Lamp Post 01",
    category: "STRUCTURE",
    asset_key: "LAMP_POST_01",
    default_state_json: JSON.stringify({
      visualHint: "LAMP_POST",
      family: "DECOR",
    }),
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert(
      "ga_scene_object_def",
      SCENE_OBJECT_DEFS.map((entry) => ({
        ...entry,
        is_active: true,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "ga_scene_object_def",
      {
        code: {
          [Sequelize.Op.in]: SCENE_OBJECT_DEFS.map((entry) => entry.code),
        },
      }
    );
  },
};
