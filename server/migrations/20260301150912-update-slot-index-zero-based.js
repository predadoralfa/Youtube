"use strict";

module.exports = {
  async up(queryInterface) {
    // 1) Descobre quais containers estão 1-based (min=1 e sem slot 0)
    const [rows] = await queryInterface.sequelize.query(`
      SELECT s.container_id
      FROM ga_container_slot s
      GROUP BY s.container_id
      HAVING MIN(s.slot_index) = 1
         AND SUM(CASE WHEN s.slot_index = 0 THEN 1 ELSE 0 END) = 0
    `);

    const containerIds = rows.map((r) => r.container_id);
    if (!containerIds.length) return;

    // 2) Shift: slot_index = slot_index - 1 para esses containers
    // Usa IN() direto (lista pequena normalmente). Se ficar grande, a gente otimiza depois.
    await queryInterface.sequelize.query(
      `
      UPDATE ga_container_slot
      SET slot_index = slot_index - 1
      WHERE container_id IN (${containerIds.map(() => "?").join(",")})
      `,
      { replacements: containerIds }
    );
  },

  async down(queryInterface) {
    // Reverte apenas o que foi shiftado (mesma lógica ao contrário)
    const [rows] = await queryInterface.sequelize.query(`
      SELECT s.container_id
      FROM ga_container_slot s
      GROUP BY s.container_id
      HAVING MIN(s.slot_index) = 0
         AND SUM(CASE WHEN s.slot_index = -1 THEN 1 ELSE 0 END) = 0
    `);

    const containerIds = rows.map((r) => r.container_id);
    if (!containerIds.length) return;

    await queryInterface.sequelize.query(
      `
      UPDATE ga_container_slot
      SET slot_index = slot_index + 1
      WHERE container_id IN (${containerIds.map(() => "?").join(",")})
      `,
      { replacements: containerIds }
    );
  },
};