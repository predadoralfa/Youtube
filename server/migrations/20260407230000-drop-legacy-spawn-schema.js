"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_enemy_runtime", "spawn_instance_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "ga_spawn_instance",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.changeColumn("ga_enemy_runtime", "spawn_def_component_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "ga_spawn_def_component",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_spawn_def_entry").catch(() => {});
    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_spawn_point").catch(() => {});

    await queryInterface.removeColumn("ga_enemy_runtime", "spawn_def_entry_id");
    await queryInterface.removeColumn("ga_enemy_runtime", "spawn_point_id");

    await queryInterface.dropTable("ga_enemy_instance_stats");
    await queryInterface.dropTable("ga_enemy_instance");
    await queryInterface.dropTable("ga_spawn_entry");
    await queryInterface.dropTable("ga_spawn_point");
    await queryInterface.dropTable("ga_spawn_def_entry");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_spawn_point", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      instance_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_instance",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      spawn_def_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "ga_spawn_def",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      spawn_kind: {
        type: Sequelize.ENUM("ENEMY"),
        allowNull: false,
        defaultValue: "ENEMY",
      },
      shape_kind: {
        type: Sequelize.ENUM("POINT", "CIRCLE"),
        allowNull: false,
        defaultValue: "POINT",
      },
      pos_x: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      pos_z: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      radius: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      patrol_radius: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 5,
      },
      patrol_wait_ms: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 10000,
      },
      patrol_stop_radius: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0.5,
      },
      max_alive: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      respawn_ms: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30000,
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

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_spawn_point
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_spawn_point", ["instance_id"], {
      name: "ix_ga_spawn_point_instance",
    });
    await queryInterface.addIndex("ga_spawn_point", ["status"], {
      name: "ix_ga_spawn_point_status",
    });
    await queryInterface.addIndex("ga_spawn_point", ["spawn_def_id"], {
      name: "ix_ga_spawn_point_spawn_def",
    });

    await queryInterface.createTable("ga_spawn_entry", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      spawn_point_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_point",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      enemy_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_enemy_def",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      weight: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      quantity_min: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      quantity_max: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      alive_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_spawn_entry
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_spawn_entry", ["spawn_point_id"], {
      name: "ix_ga_spawn_entry_spawn_point",
    });
    await queryInterface.addIndex("ga_spawn_entry", ["enemy_def_id"], {
      name: "ix_ga_spawn_entry_enemy_def",
    });
    await queryInterface.addIndex("ga_spawn_entry", ["status"], {
      name: "ix_ga_spawn_entry_status",
    });

    await queryInterface.createTable("ga_spawn_def_entry", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      spawn_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_def",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      enemy_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_enemy_def",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      weight: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      quantity_min: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      quantity_max: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      alive_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_spawn_def_entry
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_spawn_def_entry", ["spawn_def_id"], {
      name: "ix_ga_spawn_def_entry_spawn_def",
    });
    await queryInterface.addIndex("ga_spawn_def_entry", ["enemy_def_id"], {
      name: "ix_ga_spawn_def_entry_enemy_def",
    });
    await queryInterface.addIndex("ga_spawn_def_entry", ["status"], {
      name: "ix_ga_spawn_def_entry_status",
    });

    await queryInterface.createTable("ga_enemy_instance", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      spawn_point_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_point",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      spawn_entry_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_entry",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      enemy_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_enemy_def",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("ALIVE", "DEAD", "DESPAWNED"),
        allowNull: false,
        defaultValue: "ALIVE",
      },
      pos_x: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      pos_z: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      yaw: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      home_x: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      home_z: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      spawned_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      dead_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      respawn_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_enemy_instance
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_enemy_instance", ["spawn_point_id"], {
      name: "ix_ga_enemy_instance_spawn_point",
    });
    await queryInterface.addIndex("ga_enemy_instance", ["status"], {
      name: "ix_ga_enemy_instance_status",
    });

    await queryInterface.createTable("ga_enemy_instance_stats", {
      enemy_instance_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "ga_enemy_instance",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      hp_current: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      hp_max: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      move_speed: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      attack_speed: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
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

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_enemy_instance_stats
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_enemy_instance_stats", ["hp_current"], {
      name: "ix_ga_enemy_instance_stats_hp_current",
    });

    await queryInterface.addColumn("ga_enemy_runtime", "spawn_point_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "ga_spawn_point",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      after: "spawn_def_component_id",
    });

    await queryInterface.addColumn("ga_enemy_runtime", "spawn_def_entry_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "ga_spawn_def_entry",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      after: "spawn_point_id",
    });

    await queryInterface.addIndex("ga_enemy_runtime", ["spawn_point_id"], {
      name: "ix_ga_enemy_runtime_spawn_point",
    });
    await queryInterface.addIndex("ga_enemy_runtime", ["spawn_def_entry_id"], {
      name: "ix_ga_enemy_runtime_spawn_def_entry",
    });
  },
};
