"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const defs = await queryInterface.sequelize.query(
      `
        SELECT id, code
        FROM ga_container_def
        WHERE code IN ('HAND_L', 'HAND_R')
      `,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const byCode = new Map(defs.map((row) => [String(row.code), Number(row.id)]));
    const handLId = byCode.get("HAND_L");
    const handRId = byCode.get("HAND_R");

    if (!handLId || !handRId) {
      throw new Error("Missing HAND_L/HAND_R container defs while repairing links");
    }

    await queryInterface.sequelize.query(
      `
        UPDATE ga_container c
        JOIN ga_container_owner o ON o.container_id = c.id
        SET c.container_def_id = CASE
          WHEN o.slot_role = 'HAND_L' THEN ${handLId}
          WHEN o.slot_role = 'HAND_R' THEN ${handRId}
          ELSE c.container_def_id
        END,
        c.state = 'ACTIVE'
        WHERE o.owner_kind = 'PLAYER'
          AND o.slot_role IN ('HAND_L', 'HAND_R')
          AND (
            c.container_def_id IS NULL
            OR (
              o.slot_role = 'HAND_L' AND c.container_def_id <> ${handLId}
            )
            OR (
              o.slot_role = 'HAND_R' AND c.container_def_id <> ${handRId}
            )
          )
      `
    );
  },

  async down() {
    // Reversão manual não é segura porque o vínculo correto depende do estado legado do inventário.
  },
};
