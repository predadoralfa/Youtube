"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO ga_instance_spawn_config (
        instance_id,
        enemy_spawn_enabled,
        respawn_multiplier,
        spawn_quantity_multiplier,
        max_alive_multiplier,
        spawn_tick_ms,
        created_at,
        updated_at
      )
      SELECT
        i.id,
        1,
        1.000,
        1.000,
        1.000,
        60000,
        NOW(),
        NOW()
      FROM ga_instance i
      LEFT JOIN ga_instance_spawn_config isc ON isc.instance_id = i.id
      WHERE isc.instance_id IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE isc
      FROM ga_instance_spawn_config isc
      LEFT JOIN ga_spawn_instance si ON si.instance_id = isc.instance_id
      LEFT JOIN ga_user_runtime ur ON ur.instance_id = isc.instance_id
      WHERE si.id IS NULL
        AND ur.user_id IS NULL
    `);
  },
};
