"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Garante que a tabela referenciada suporta FK (InnoDB).
    const [statusRows] = await queryInterface.sequelize.query(
      `SHOW TABLE STATUS LIKE 'ga_user_container';`
    );
    const engine = statusRows?.[0]?.Engine;
    if (engine && String(engine).toUpperCase() !== "INNODB") {
      await queryInterface.sequelize.query(
        `ALTER TABLE ga_user_container ENGINE=InnoDB;`
      );
    }

    // 2) Pega o tipo exato do ID para evitar mismatch SIGNED/UNSIGNED e INT/BIGINT.
    const [colRows] = await queryInterface.sequelize.query(
      `
      SELECT COLUMN_TYPE, DATA_TYPE
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'ga_user_container'
        AND column_name = 'id'
      `
    );

    const columnType = String(colRows?.[0]?.COLUMN_TYPE || "").toLowerCase(); // ex: "bigint(20) unsigned"
    const dataType = String(colRows?.[0]?.DATA_TYPE || "").toLowerCase();     // ex: "bigint"

    if (!columnType || !dataType) {
      throw new Error("Não consegui ler o tipo de ga_user_container.id via information_schema.");
    }

    const isBig = dataType.includes("bigint");
    const isUnsigned = columnType.includes("unsigned");

    const containerIdType = isBig
      ? (isUnsigned ? Sequelize.BIGINT.UNSIGNED : Sequelize.BIGINT)
      : (isUnsigned ? Sequelize.INTEGER.UNSIGNED : Sequelize.INTEGER);

    await queryInterface.createTable("ga_container_owner", {
      container_id: {
        type: containerIdType,
        allowNull: false,
        references: { model: "ga_user_container", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        primaryKey: true,
      },

      owner_kind: {
        type: Sequelize.ENUM("PLAYER", "ACTOR"),
        allowNull: false,
        primaryKey: true,
      },

      owner_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
      },

      slot_role: {
        type: Sequelize.STRING(64),
        allowNull: false,
        primaryKey: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Auto-update updated_at (padrão MySQL)
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_container_owner
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    // UNIQUE (owner_kind, owner_id, slot_role)
    await queryInterface.addConstraint("ga_container_owner", {
      type: "unique",
      name: "uq_ga_container_owner_owner_role",
      fields: ["owner_kind", "owner_id", "slot_role"],
    });

    // Índices úteis
    await queryInterface.addIndex("ga_container_owner", ["container_id"], {
      name: "ix_ga_container_owner_container_id",
    });

    await queryInterface.addIndex("ga_container_owner", ["owner_kind", "owner_id"], {
      name: "ix_ga_container_owner_owner",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_container_owner", "ix_ga_container_owner_owner").catch(() => {});
    await queryInterface.removeIndex("ga_container_owner", "ix_ga_container_owner_container_id").catch(() => {});
    await queryInterface.removeConstraint("ga_container_owner", "uq_ga_container_owner_owner_role").catch(() => {});
    await queryInterface.dropTable("ga_container_owner");
  },
};