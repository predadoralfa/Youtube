"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO ga_local (
        id,
        code,
        name,
        description,
        local_type,
        parent_id,
        is_active,
        created_at,
        updated_at
      )
      VALUES
        (5, 'UNIVERSO', 'Universo', 'Universo', 'UNIVERSO', NULL, 1, NOW(), NOW()),
        (6, 'PLANETA_ERETZ', 'Eretz', 'Estrutura raiz do mundo persistente.', 'PLANETA', 5, 1, NOW(), NOW()),
        (16, 'SETOR_MONTIVALLIS', 'Montivallis', 'Campos abertos, manchas de floresta e serras antigas. Região de caça e coleta.', 'SETOR', 6, 1, NOW(), NOW()),
        (18, 'CIDADE_AYIN', 'Ayin', 'Assentamento inicial próximo a uma nascente. Ponto de reunião de caçadores e coletores.', 'CIDADE', 16, 1, NOW(), NOW()),
        (19, 'LOCAL_CABANA_DO_COLETOR', 'Cabana do Coletor', 'Abrigo simples de madeira e couro.', 'LOCAL', 18, 1, NOW(), NOW()),
        (21, 'CIDADE_DEV', 'Desenvolvimento City', 'Destinado apenas para GMs e convidados para desenvoler mecanicas', 'CIDADE', 16, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        name = VALUES(name),
        description = VALUES(description),
        local_type = VALUES(local_type),
        parent_id = VALUES(parent_id),
        is_active = VALUES(is_active)
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_local_geometry (local_id, size_x, size_z)
      VALUES
        (5, 1000000000, 1000000000),
        (6, 1000000, 1000000),
        (16, 10000, 100000),
        (18, 1000, 1000),
        (19, 500, 500),
        (21, 100, 100)
      ON DUPLICATE KEY UPDATE
        size_x = VALUES(size_x),
        size_z = VALUES(size_z)
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_local_visual (
        local_id,
        ground_material_id,
        ground_mesh_id,
        ground_render_material_id,
        version
      )
      VALUES
        (16, 3, NULL, NULL, 1),
        (18, 2, NULL, NULL, 1),
        (19, 3, NULL, NULL, 1),
        (21, 4, 1, 1, 1)
      ON DUPLICATE KEY UPDATE
        ground_material_id = VALUES(ground_material_id),
        ground_mesh_id = VALUES(ground_mesh_id),
        ground_render_material_id = VALUES(ground_render_material_id),
        version = VALUES(version)
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ga_instance (
        id,
        local_id,
        instance_type,
        current_era_id,
        status,
        created_at,
        updated_at
      )
      VALUES
        (1, 5, 'UNIVERSO', 1, 'ONLINE', NOW(), NOW()),
        (2, 6, 'PLANETA', 1, 'ONLINE', NOW(), NOW()),
        (3, 16, 'SETOR', 1, 'ONLINE', NOW(), NOW()),
        (4, 18, 'CIDADE', 1, 'ONLINE', NOW(), NOW()),
        (5, 19, 'LOCAL', 1, 'ONLINE', NOW(), NOW()),
        (6, 21, 'CIDADE', 1, 'ONLINE', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        local_id = VALUES(local_id),
        instance_type = VALUES(instance_type),
        current_era_id = VALUES(current_era_id),
        status = VALUES(status)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM ga_instance
      WHERE id IN (1, 2, 3, 4, 5, 6)
        AND local_id IN (5, 6, 16, 18, 19, 21)
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM ga_local_visual
      WHERE local_id IN (16, 18, 19, 21)
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM ga_local_geometry
      WHERE local_id IN (5, 6, 16, 18, 19, 21)
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM ga_local
      WHERE id IN (5, 6, 16, 18, 19, 21)
    `);
  },
};
