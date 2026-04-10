"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO ga_material (id, code, name, friction, restitution)
      VALUES
        (1, 'GRASS', 'Grama', 0.9, 0.05),
        (2, 'DIRT', 'Terra', 0.8, 0.02),
        (3, 'STONE', 'Pedra', 0.8, 0.02),
        (4, 'MAT_CONCRETO', 'Concreto', 0.85, 0.05)
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        name = VALUES(name),
        friction = VALUES(friction),
        restitution = VALUES(restitution)
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_render_material (
        id,
        code,
        kind,
        base_color,
        texture_url,
        roughness,
        metalness,
        created_at,
        updated_at
      )
      VALUES
        (1, 'RM_CONCRETO_CINZA', 'color', '#8A8A8A', NULL, 0.9, 0, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        kind = VALUES(kind),
        base_color = VALUES(base_color),
        texture_url = VALUES(texture_url),
        roughness = VALUES(roughness),
        metalness = VALUES(metalness)
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_mesh_template (
        id,
        code,
        mesh_kind,
        primitive_type,
        gltf_url,
        default_scale_x,
        default_scale_y,
        default_scale_z,
        created_at,
        updated_at
      )
      VALUES
        (1, 'MESH_PLANE_GROUND', 'primitive', 'plane', NULL, 1, 1, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        mesh_kind = VALUES(mesh_kind),
        primitive_type = VALUES(primitive_type),
        gltf_url = VALUES(gltf_url),
        default_scale_x = VALUES(default_scale_x),
        default_scale_y = VALUES(default_scale_y),
        default_scale_z = VALUES(default_scale_z)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM ga_mesh_template
      WHERE id = 1 AND code = 'MESH_PLANE_GROUND'
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM ga_render_material
      WHERE id = 1 AND code = 'RM_CONCRETO_CINZA'
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM ga_material
      WHERE id IN (1, 2, 3, 4)
        AND code IN ('GRASS', 'DIRT', 'STONE', 'MAT_CONCRETO')
    `);
  },
};
