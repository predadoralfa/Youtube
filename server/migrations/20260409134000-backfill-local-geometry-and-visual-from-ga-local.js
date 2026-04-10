"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO ga_local_geometry (local_id, size_x, size_z)
      SELECT
        l.id,
        CASE l.local_type
          WHEN 'UNIVERSO' THEN 1000000000
          WHEN 'PLANETA' THEN 1000000
          WHEN 'SETOR' THEN 10000
          WHEN 'CIDADE' THEN 1000
          ELSE 500
        END AS size_x,
        CASE l.local_type
          WHEN 'UNIVERSO' THEN 1000000000
          WHEN 'PLANETA' THEN 1000000
          WHEN 'SETOR' THEN 10000
          WHEN 'CIDADE' THEN 1000
          ELSE 500
        END AS size_z
      FROM ga_local l
      LEFT JOIN ga_local_geometry g ON g.local_id = l.id
      WHERE g.local_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_local_visual (
        local_id,
        ground_material_id,
        ground_mesh_id,
        ground_render_material_id,
        version
      )
      SELECT
        l.id,
        CASE
          WHEN l.code = 'CIDADE_DEV' THEN (
            SELECT id FROM ga_material WHERE code = 'MAT_CONCRETO' LIMIT 1
          )
          WHEN l.local_type = 'CIDADE' THEN (
            SELECT id FROM ga_material WHERE code = 'DIRT' LIMIT 1
          )
          WHEN l.local_type = 'SETOR' THEN (
            SELECT id FROM ga_material WHERE code = 'STONE' LIMIT 1
          )
          WHEN l.local_type = 'LOCAL' THEN (
            SELECT id FROM ga_material WHERE code = 'STONE' LIMIT 1
          )
          ELSE NULL
        END AS ground_material_id,
        CASE
          WHEN l.code = 'CIDADE_DEV' THEN (
            SELECT id FROM ga_mesh_template WHERE code = 'MESH_PLANE_GROUND' LIMIT 1
          )
          ELSE NULL
        END AS ground_mesh_id,
        CASE
          WHEN l.code = 'CIDADE_DEV' THEN (
            SELECT id FROM ga_render_material WHERE code = 'RM_CONCRETO_CINZA' LIMIT 1
          )
          ELSE NULL
        END AS ground_render_material_id,
        1 AS version
      FROM ga_local l
      LEFT JOIN ga_local_visual v ON v.local_id = l.id
      WHERE v.local_id IS NULL
        AND l.local_type IN ('SETOR', 'CIDADE', 'LOCAL')
        AND (
          CASE
            WHEN l.code = 'CIDADE_DEV' THEN (
              SELECT id FROM ga_material WHERE code = 'MAT_CONCRETO' LIMIT 1
            )
            WHEN l.local_type = 'CIDADE' THEN (
              SELECT id FROM ga_material WHERE code = 'DIRT' LIMIT 1
            )
            WHEN l.local_type = 'SETOR' THEN (
              SELECT id FROM ga_material WHERE code = 'STONE' LIMIT 1
            )
            WHEN l.local_type = 'LOCAL' THEN (
              SELECT id FROM ga_material WHERE code = 'STONE' LIMIT 1
            )
            ELSE NULL
          END
        ) IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE v
      FROM ga_local_visual v
      JOIN ga_local l ON l.id = v.local_id
      WHERE l.local_type IN ('SETOR', 'CIDADE', 'LOCAL')
        AND v.local_id NOT IN (16, 18, 19, 21)
    `);

    await queryInterface.sequelize.query(`
      DELETE g
      FROM ga_local_geometry g
      JOIN ga_local l ON l.id = g.local_id
      WHERE l.id NOT IN (5, 6, 16, 18, 19, 21)
    `);
  },
};
