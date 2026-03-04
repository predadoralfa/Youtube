"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Descobrir tipo real da coluna antiga
    const [colRows] = await queryInterface.sequelize.query(`
      SELECT COLUMN_TYPE, DATA_TYPE
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'ga_container_slot'
        AND column_name = 'user_container_id'
    `);

    if (!colRows.length) {
      // Já renomeada? então não faz nada
      const [check] = await queryInterface.sequelize.query(`
        SELECT 1 ok
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'ga_container_slot'
          AND column_name = 'container_id'
        LIMIT 1
      `);

      if (check.length) return;

      throw new Error("user_container_id não encontrada em ga_container_slot.");
    }

    const columnType = colRows[0].COLUMN_TYPE.toLowerCase();
    const dataType = colRows[0].DATA_TYPE.toLowerCase();

    const isBig = dataType.includes("bigint");
    const isUnsigned = columnType.includes("unsigned");

    const containerIdType = isBig
      ? (isUnsigned ? Sequelize.BIGINT.UNSIGNED : Sequelize.BIGINT)
      : (isUnsigned ? Sequelize.INTEGER.UNSIGNED : Sequelize.INTEGER);

    // 2) Drop FK antiga se existir
    const [fkRows] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ga_container_slot'
        AND COLUMN_NAME = 'user_container_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    if (fkRows.length) {
      const fkName = fkRows[0].CONSTRAINT_NAME;
      if (fkName !== "PRIMARY") {
        await queryInterface.sequelize.query(
          `ALTER TABLE ga_container_slot DROP FOREIGN KEY \`${fkName}\`;`
        );
      }
    }

    // 3) Se PK usa user_container_id, precisa dropar PK primeiro
    const [pkRows] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ga_container_slot'
        AND CONSTRAINT_TYPE = 'PRIMARY KEY'
    `);

    if (pkRows.length) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ga_container_slot DROP PRIMARY KEY;`
      );
    }

    // 4) Renomear coluna
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_slot
      CHANGE user_container_id container_id ${containerIdType.key || containerIdType.toSql()}
      NOT NULL;
    `);

    // 5) Recriar PK composta (container_id, slot_index)
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_slot
      ADD PRIMARY KEY (container_id, slot_index);
    `);

    // 6) Criar nova FK -> ga_container(id)
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_slot
      ADD CONSTRAINT fk_ga_container_slot_container_id
      FOREIGN KEY (container_id)
      REFERENCES ga_container(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Down simplificado (opcional)
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_slot
      DROP FOREIGN KEY fk_ga_container_slot_container_id;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_slot
      DROP PRIMARY KEY;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_slot
      CHANGE container_id user_container_id BIGINT UNSIGNED NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_slot
      ADD PRIMARY KEY (user_container_id, slot_index);
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_slot
      ADD CONSTRAINT fk_ga_container_slot_user_container_id
      FOREIGN KEY (user_container_id)
      REFERENCES ga_container(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `);
  },
};