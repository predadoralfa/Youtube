"use strict";

module.exports = {
  async up(queryInterface) {
    // 1) Se ga_container já existe, não faz rename.
    const [hasNew] = await queryInterface.sequelize.query(
      `SELECT 1 ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'ga_container' LIMIT 1;`
    );

    const [hasOld] = await queryInterface.sequelize.query(
      `SELECT 1 ok FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'ga_user_container' LIMIT 1;`
    );

    if (!hasNew?.length && hasOld?.length) {
      await queryInterface.sequelize.query(
        `RENAME TABLE ga_user_container TO ga_container;`
      );
    }

    // 2) Ajusta FK de ga_container_owner.container_id -> ga_container(id)
    // Drop qualquer FK existente nessa coluna (independente do nome)
    const [ownerFks] = await queryInterface.sequelize.query(
      `
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ga_container_owner'
        AND COLUMN_NAME = 'container_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `
    );

    if (ownerFks?.length) {
      const fkName = ownerFks[0].CONSTRAINT_NAME;
      if (fkName && fkName !== "PRIMARY") {
        await queryInterface.sequelize.query(
          `ALTER TABLE ga_container_owner DROP FOREIGN KEY \`${fkName}\`;`
        );
      }
    }

    // Recria apontando para ga_container
    const [fkToContainer] = await queryInterface.sequelize.query(
      `
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ga_container_owner'
        AND COLUMN_NAME = 'container_id'
        AND REFERENCED_TABLE_NAME = 'ga_container'
      `
    );

    if (!fkToContainer?.length) {
      await queryInterface.sequelize.query(`
        ALTER TABLE ga_container_owner
        ADD CONSTRAINT fk_ga_container_owner_container_id
        FOREIGN KEY (container_id) REFERENCES ga_container(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;
      `);
    }

    // 3) (Opcional mas seguro) Se existir FK em ga_container_slot apontando para ga_user_container, troca para ga_container
    // Atenção: aqui ainda não renomeamos coluna (isso é Etapa 4), só garantimos que o *alvo* do FK não ficou preso no nome antigo.
    const [slotHasOldCol] = await queryInterface.sequelize.query(
      `
      SELECT 1 ok
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'ga_container_slot'
        AND column_name = 'user_container_id'
      LIMIT 1;
      `
    );

    if (slotHasOldCol?.length) {
      const [slotFks] = await queryInterface.sequelize.query(
        `
        SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'ga_container_slot'
          AND COLUMN_NAME = 'user_container_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL
        `
      );

      if (slotFks?.length) {
        const fkName = slotFks[0].CONSTRAINT_NAME;
        const refTable = slotFks[0].REFERENCED_TABLE_NAME;

        // Se ainda referencia ga_user_container, refaz para ga_container
        if (String(refTable).toLowerCase() === "ga_user_container") {
          await queryInterface.sequelize.query(
            `ALTER TABLE ga_container_slot DROP FOREIGN KEY \`${fkName}\`;`
          );

          await queryInterface.sequelize.query(`
            ALTER TABLE ga_container_slot
            ADD CONSTRAINT fk_ga_container_slot_user_container_id
            FOREIGN KEY (user_container_id) REFERENCES ga_container(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE;
          `);
        }
      }
    }
  },

  async down() {
    // Repair migration: não implementamos down (evita rollback perigoso em rename).
    // Se você precisar reverter, faz-se uma migration dedicada, não automática.
  },
};