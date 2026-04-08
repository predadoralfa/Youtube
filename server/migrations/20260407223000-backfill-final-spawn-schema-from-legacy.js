"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO ga_spawn_def (
        code,
        name,
        status,
        spawn_kind,
        shape_kind,
        radius,
        max_alive,
        respawn_ms,
        patrol_radius,
        patrol_wait_ms,
        patrol_stop_radius,
        created_at,
        updated_at
      )
      SELECT
        CONCAT('LEGACY_SPAWN_POINT_', sp.id) AS code,
        CONCAT('Legacy Spawn Point #', sp.id) AS name,
        sp.status,
        sp.spawn_kind,
        sp.shape_kind,
        sp.radius,
        sp.max_alive,
        sp.respawn_ms,
        sp.patrol_radius,
        sp.patrol_wait_ms,
        sp.patrol_stop_radius,
        sp.created_at,
        sp.updated_at
      FROM ga_spawn_point sp
      WHERE NOT EXISTS (
        SELECT 1
        FROM ga_spawn_def d
        WHERE d.code = CONCAT('LEGACY_SPAWN_POINT_', sp.id)
      );
    `);

    await queryInterface.sequelize.query(`
      UPDATE ga_spawn_point sp
      INNER JOIN ga_spawn_def d
        ON d.code = CONCAT('LEGACY_SPAWN_POINT_', sp.id)
      SET sp.spawn_def_id = d.id
      WHERE sp.spawn_def_id IS NULL;
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_spawn_def_entry (
        id,
        spawn_def_id,
        enemy_def_id,
        status,
        weight,
        quantity_min,
        quantity_max,
        alive_limit,
        created_at,
        updated_at
      )
      SELECT
        se.id,
        sp.spawn_def_id,
        se.enemy_def_id,
        se.status,
        se.weight,
        se.quantity_min,
        se.quantity_max,
        se.alive_limit,
        se.created_at,
        se.updated_at
      FROM ga_spawn_entry se
      INNER JOIN ga_spawn_point sp
        ON sp.id = se.spawn_point_id
      WHERE sp.spawn_def_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM ga_spawn_def_entry sde
          WHERE sde.id = se.id
        );
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_spawn_def_component (
        id,
        spawn_def_id,
        enemy_def_id,
        status,
        weight,
        quantity_min,
        quantity_max,
        alive_limit,
        flags_json,
        created_at,
        updated_at
      )
      SELECT
        se.id,
        sp.spawn_def_id,
        se.enemy_def_id,
        se.status,
        se.weight,
        se.quantity_min,
        se.quantity_max,
        se.alive_limit,
        NULL,
        se.created_at,
        se.updated_at
      FROM ga_spawn_entry se
      INNER JOIN ga_spawn_point sp
        ON sp.id = se.spawn_point_id
      WHERE sp.spawn_def_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM ga_spawn_def_component sdc
          WHERE sdc.id = se.id
        );
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_spawn_instance (
        id,
        instance_id,
        spawn_def_id,
        status,
        pos_x,
        pos_z,
        yaw,
        override_json,
        created_at,
        updated_at
      )
      SELECT
        sp.id,
        sp.instance_id,
        sp.spawn_def_id,
        sp.status,
        sp.pos_x,
        sp.pos_z,
        NULL,
        NULL,
        sp.created_at,
        sp.updated_at
      FROM ga_spawn_point sp
      WHERE sp.spawn_def_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM ga_spawn_instance si
          WHERE si.id = sp.id
        );
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_enemy_runtime (
        id,
        spawn_instance_id,
        spawn_def_component_id,
        spawn_point_id,
        spawn_def_entry_id,
        enemy_def_id,
        status,
        pos_x,
        pos_z,
        yaw,
        home_x,
        home_z,
        spawned_at,
        dead_at,
        respawn_at,
        created_at,
        updated_at
      )
      SELECT
        ei.id,
        ei.spawn_point_id,
        ei.spawn_entry_id,
        ei.spawn_point_id,
        ei.spawn_entry_id,
        ei.enemy_def_id,
        ei.status,
        ei.pos_x,
        ei.pos_z,
        ei.yaw,
        ei.home_x,
        ei.home_z,
        ei.spawned_at,
        ei.dead_at,
        ei.respawn_at,
        ei.created_at,
        ei.updated_at
      FROM ga_enemy_instance ei
      WHERE NOT EXISTS (
        SELECT 1
        FROM ga_enemy_runtime er
        WHERE er.id = ei.id
      );
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_enemy_runtime_stats (
        enemy_runtime_id,
        hp_current,
        hp_max,
        move_speed,
        attack_speed,
        created_at,
        updated_at
      )
      SELECT
        eis.enemy_instance_id,
        eis.hp_current,
        eis.hp_max,
        eis.move_speed,
        eis.attack_speed,
        eis.created_at,
        eis.updated_at
      FROM ga_enemy_instance_stats eis
      WHERE NOT EXISTS (
        SELECT 1
        FROM ga_enemy_runtime_stats ers
        WHERE ers.enemy_runtime_id = eis.enemy_instance_id
      );
    `);

    await queryInterface.sequelize.query(`
      UPDATE ga_enemy_runtime er
      SET
        er.spawn_instance_id = COALESCE(er.spawn_instance_id, er.spawn_point_id),
        er.spawn_def_component_id = COALESCE(er.spawn_def_component_id, er.spawn_def_entry_id)
      WHERE er.spawn_instance_id IS NULL
         OR er.spawn_def_component_id IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE ers
      FROM ga_enemy_runtime_stats ers
      INNER JOIN ga_enemy_runtime er
        ON er.id = ers.enemy_runtime_id
      WHERE er.id IN (
        SELECT id FROM ga_enemy_instance
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE er
      FROM ga_enemy_runtime er
      WHERE er.id IN (
        SELECT id FROM ga_enemy_instance
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE si
      FROM ga_spawn_instance si
      WHERE si.id IN (
        SELECT id FROM ga_spawn_point
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE sdc
      FROM ga_spawn_def_component sdc
      WHERE sdc.id IN (
        SELECT id FROM ga_spawn_entry
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE sde
      FROM ga_spawn_def_entry sde
      WHERE sde.id IN (
        SELECT id FROM ga_spawn_entry
      );
    `);

    await queryInterface.sequelize.query(`
      UPDATE ga_spawn_point
      SET spawn_def_id = NULL
      WHERE spawn_def_id IN (
        SELECT id
        FROM ga_spawn_def
        WHERE code LIKE 'LEGACY_SPAWN_POINT_%'
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE
      FROM ga_spawn_def
      WHERE code LIKE 'LEGACY_SPAWN_POINT_%';
    `);
  },
};
