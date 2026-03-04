"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (t) => {
      // Backfill: 1 owner por container já existente
      // container_id = ga_user_container.id
      // owner_kind  = 'PLAYER'
      // owner_id    = ga_user_container.user_id
      // slot_role   = ga_user_container.slot_role
      //
      // Observação: não usamos INSERT IGNORE / ON DUPLICATE.
      // Se quebrar UNIQUE/PK, é porque há duplicidade real que precisa ser corrigida.
      await queryInterface.sequelize.query(
        `
        INSERT INTO ga_container_owner (container_id, owner_kind, owner_id, slot_role)
        SELECT
          uc.id          AS container_id,
          'PLAYER'       AS owner_kind,
          uc.user_id     AS owner_id,
          uc.slot_role   AS slot_role
        FROM ga_user_container uc
        `,
        { transaction: t }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (t) => {
      // Reverte apenas o que foi inserido para PLAYER.
      // (Na etapa 6 você poderá ter ACTOR; isso não pode ser apagado aqui.)
      await queryInterface.sequelize.query(
        `
        DELETE FROM ga_container_owner
        WHERE owner_kind = 'PLAYER'
        `,
        { transaction: t }
      );
    });
  },
};