"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      // 1) Corrige dados ruins antes (evita falha ao tornar NOT NULL)
      await queryInterface.sequelize.query(
        `UPDATE ga_item_def SET stack_max = 1 WHERE stack_max IS NULL OR stack_max < 1`,
        { transaction: t }
      );

      // 2) Garante stack_max NOT NULL, default 1, e (opcional) UNSIGNED
      await queryInterface.changeColumn(
        "ga_item_def",
        "stack_max",
        {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 1,
        },
        { transaction: t }
      );

      // 3) CHECK stack_max >= 1 (MySQL 8.0.16+ aplica; versões antigas ignoram)
      // Se der erro por versão, pode comentar este bloco e manter validação no código.
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE ga_item_def ADD CONSTRAINT chk_ga_item_def_stack_max CHECK (stack_max >= 1)`,
          { transaction: t }
        );
      } catch (e) {
        // ok: MySQL antigo pode rejeitar/ignorar CHECK
      }

      // 4) Remove coluna is_stackable
      // (se não existir em algum ambiente, o try evita quebrar)
      try {
        await queryInterface.removeColumn("ga_item_def", "is_stackable", { transaction: t });
      } catch (e) {
        // ok
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      // 1) Recria is_stackable
      await queryInterface.addColumn(
        "ga_item_def",
        "is_stackable",
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        { transaction: t }
      );

      // 2) Remove CHECK se existir
      try {
        // Em MySQL pode ser DROP CHECK ou DROP CONSTRAINT dependendo da versão.
        // Tentamos os dois.
        await queryInterface.sequelize.query(
          `ALTER TABLE ga_item_def DROP CHECK chk_ga_item_def_stack_max`,
          { transaction: t }
        );
      } catch {}
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE ga_item_def DROP CONSTRAINT chk_ga_item_def_stack_max`,
          { transaction: t }
        );
      } catch {}

      // 3) Volta stack_max para signed (opcional) mantendo NOT NULL/default
      await queryInterface.changeColumn(
        "ga_item_def",
        "stack_max",
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        { transaction: t }
      );

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};