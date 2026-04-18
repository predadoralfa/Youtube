"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [renderRows] = await queryInterface.sequelize.query(
        `
          SELECT id
          FROM ga_render_material
          WHERE code = 'RM_CONCRETO_CINZA'
          LIMIT 1
        `,
        { transaction }
      );

      const [meshRows] = await queryInterface.sequelize.query(
        `
          SELECT id
          FROM ga_mesh_template
          WHERE code = 'MESH_PLANE_GROUND'
          LIMIT 1
        `,
        { transaction }
      );

      const renderMaterialId = Number(renderRows?.[0]?.id ?? 0) || null;
      const meshId = Number(meshRows?.[0]?.id ?? 0) || null;

      if (!renderMaterialId) {
        throw new Error("Nao foi possivel localizar RM_CONCRETO_CINZA para montar o visual do Montevales.");
      }

      if (!meshId) {
        throw new Error("Nao foi possivel localizar MESH_PLANE_GROUND para montar o visual do Montevales.");
      }

      const [localVisualRows] = await queryInterface.sequelize.query(
        `
          SELECT local_id
          FROM ga_local_visual
          WHERE local_id = 16
          LIMIT 1
        `,
        { transaction }
      );

      if (localVisualRows.length > 0) {
        await queryInterface.sequelize.query(
          `
            UPDATE ga_local_visual
            SET
              ground_mesh_id = :meshId,
              ground_render_material_id = :renderMaterialId,
              version = version + 1
            WHERE local_id = 16
          `,
          {
            replacements: { meshId, renderMaterialId },
            transaction,
          }
        );
      } else {
        await queryInterface.sequelize.query(
          `
            INSERT INTO ga_local_visual (
              local_id,
              ground_material_id,
              ground_mesh_id,
              ground_render_material_id,
              version
            )
            VALUES (
              16,
              (SELECT id FROM ga_material WHERE code = 'STONE' LIMIT 1),
              :meshId,
              :renderMaterialId,
              1
            )
          `,
          {
            replacements: { meshId, renderMaterialId },
            transaction,
          }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          UPDATE ga_local_visual
          SET
            ground_mesh_id = NULL,
            ground_render_material_id = NULL
          WHERE local_id = 16
        `,
        { transaction }
      );
    });
  },
};
