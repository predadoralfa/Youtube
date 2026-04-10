"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "ga_user"))) {
      await queryInterface.createTable("ga_user", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        senha: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_user", ["email"], {
        name: "ga_user_email",
        unique: true,
      });
    }

    if (!(await tableExists(queryInterface, "ga_user_profile"))) {
      await queryInterface.createTable("ga_user_profile", {
        user_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          allowNull: false,
          references: { model: "ga_user", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        display_name: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_user_profile", ["display_name"], {
        name: "ga_user_profile_display_name",
        unique: true,
      });
    }

    if (!(await tableExists(queryInterface, "ga_container_def"))) {
      await queryInterface.createTable("ga_container_def", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        code: {
          type: Sequelize.STRING(64),
          allowNull: false,
          unique: true,
        },
        name: {
          type: Sequelize.STRING(80),
          allowNull: false,
        },
        slot_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        max_weight: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
        allowed_categories_mask: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      });
      await queryInterface.addIndex("ga_container_def", ["code"], {
        name: "ga_container_def_code",
        unique: true,
      });
    }

    if (!(await tableExists(queryInterface, "ga_local"))) {
      await queryInterface.createTable("ga_local", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        code: {
          type: Sequelize.STRING(48),
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(80),
          allowNull: false,
        },
        description: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        local_type: {
          type: Sequelize.ENUM("UNIVERSO", "PLANETA", "SETOR", "CIDADE", "LOCAL"),
          allowNull: false,
        },
        parent_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "ga_local", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "NO ACTION",
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_local", ["code"], {
        name: "ga_local_code",
        unique: true,
      });
      await queryInterface.addIndex("ga_local", ["parent_id"], {
        name: "ga_local_parent_id",
      });
    }

    if (!(await tableExists(queryInterface, "ga_material"))) {
      await queryInterface.createTable("ga_material", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        code: {
          type: Sequelize.STRING(48),
          allowNull: false,
          unique: true,
        },
        name: {
          type: Sequelize.STRING(80),
          allowNull: false,
        },
        friction: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0.8,
        },
        restitution: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0.1,
        },
      });
      await queryInterface.addIndex("ga_material", ["code"], {
        name: "ga_material_code",
        unique: true,
      });
    }

    if (!(await tableExists(queryInterface, "ga_mesh_template"))) {
      await queryInterface.createTable("ga_mesh_template", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        code: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        mesh_kind: {
          type: Sequelize.ENUM("primitive", "gltf"),
          allowNull: false,
          defaultValue: "primitive",
        },
        primitive_type: {
          type: Sequelize.ENUM("plane", "box", "sphere", "cylinder"),
          allowNull: true,
        },
        gltf_url: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        default_scale_x: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1,
        },
        default_scale_y: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1,
        },
        default_scale_z: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_mesh_template", ["code"], {
        name: "ga_mesh_template_code",
        unique: true,
      });
    }

    if (!(await tableExists(queryInterface, "ga_render_material"))) {
      await queryInterface.createTable("ga_render_material", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        code: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        kind: {
          type: Sequelize.ENUM("color", "texture", "pbr", "shader"),
          allowNull: false,
          defaultValue: "color",
        },
        base_color: {
          type: Sequelize.STRING(16),
          allowNull: true,
        },
        texture_url: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        roughness: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
        metalness: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_render_material", ["code"], {
        name: "ga_render_material_code",
        unique: true,
      });
    }

    if (!(await tableExists(queryInterface, "ga_local_geometry"))) {
      await queryInterface.createTable("ga_local_geometry", {
        local_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          allowNull: false,
          references: { model: "ga_local", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        size_x: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 200,
        },
        size_z: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 200,
        },
      });
    }

    if (!(await tableExists(queryInterface, "ga_local_visual"))) {
      await queryInterface.createTable("ga_local_visual", {
        local_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          allowNull: false,
          references: { model: "ga_local", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        ground_mesh_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "ga_mesh_template", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        ground_render_material_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "ga_render_material", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_local_visual", ["local_id"], {
        name: "ga_local_visual_local_id",
        unique: true,
      });
      await queryInterface.addIndex("ga_local_visual", ["ground_mesh_id"], {
        name: "ga_local_visual_ground_mesh_id",
      });
      await queryInterface.addIndex("ga_local_visual", ["ground_render_material_id"], {
        name: "ga_local_visual_ground_render_material_id",
      });
    }

    if (!(await tableExists(queryInterface, "ga_instance"))) {
      await queryInterface.createTable("ga_instance", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        local_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "ga_local", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        instance_type: {
          type: Sequelize.STRING(24),
          allowNull: false,
          defaultValue: "LOCAL",
        },
        current_era_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "ga_era_def", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        status: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: "ONLINE",
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_instance", ["local_id"], {
        name: "ga_instance_local_id",
      });
      await queryInterface.addIndex("ga_instance", ["status"], {
        name: "ga_instance_status",
      });
    }

    if (!(await tableExists(queryInterface, "ga_item_def"))) {
      await queryInterface.createTable("ga_item_def", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        code: {
          type: Sequelize.STRING(64),
          allowNull: false,
          unique: true,
        },
        name: {
          type: Sequelize.STRING(80),
          allowNull: false,
        },
        category: {
          type: Sequelize.ENUM("CONSUMABLE", "FOOD", "EQUIP", "AMMO", "MATERIAL", "QUEST", "CONTAINER", "MISC"),
          allowNull: false,
          defaultValue: "MISC",
        },
        stack_max: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 1,
        },
        unit_weight: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0,
        },
        era_min_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "ga_era_def", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      });
      await queryInterface.addIndex("ga_item_def", ["code"], {
        name: "ga_item_def_code",
        unique: true,
      });
      await queryInterface.addIndex("ga_item_def", ["category"], {
        name: "ga_item_def_category",
      });
      await queryInterface.addIndex("ga_item_def", ["is_active"], {
        name: "ga_item_def_is_active",
      });
    }

    if (!(await tableExists(queryInterface, "ga_item_def_component"))) {
      await queryInterface.createTable("ga_item_def_component", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        item_def_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "ga_item_def", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        component_type: {
          type: Sequelize.ENUM(
            "EDIBLE",
            "CONSUMABLE",
            "EQUIPPABLE",
            "GRANTS_CONTAINER",
            "WEAPON",
            "ARMOR",
            "TOOL"
          ),
          allowNull: false,
        },
        data_json: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
      });
      await queryInterface.addIndex("ga_item_def_component", ["item_def_id"], {
        name: "ga_item_def_component_item_def_id",
      });
      await queryInterface.addIndex("ga_item_def_component", ["component_type"], {
        name: "ga_item_def_component_component_type",
      });
    }

    if (!(await tableExists(queryInterface, "ga_user_runtime"))) {
      await queryInterface.createTable("ga_user_runtime", {
        user_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          allowNull: false,
          references: { model: "ga_user", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        instance_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 4,
          references: { model: "ga_instance", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        pos_x: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 50,
        },
        pos_y: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 50,
        },
        pos_z: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 10,
        },
        yaw: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0,
        },
        camera_pitch: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: Math.PI / 4,
        },
        camera_distance: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 26,
        },
        connection_state: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: "OFFLINE",
        },
        disconnected_at: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        offline_allowed_at: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_user_runtime", ["instance_id"], {
        name: "ga_user_runtime_instance_id",
      });
    }

    if (!(await tableExists(queryInterface, "ga_user_stats"))) {
      await queryInterface.createTable("ga_user_stats", {
        user_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          allowNull: false,
          references: { model: "ga_user", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        hp_current: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 100,
        },
        hp_max: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 100,
        },
        stamina_current: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 100,
        },
        stamina_max: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 100,
        },
        hunger_current: {
          type: Sequelize.DOUBLE.UNSIGNED,
          allowNull: false,
          defaultValue: 100,
        },
        hunger_max: {
          type: Sequelize.DOUBLE.UNSIGNED,
          allowNull: false,
          defaultValue: 100,
        },
        attack_power: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 10,
        },
        defense: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        attack_speed: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1,
        },
        attack_range: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1,
        },
        move_speed: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 5,
        },
        collect_cooldown_ms: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 1000,
        },
        carry_weight: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 20,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    if (!(await tableExists(queryInterface, "ga_item_instance"))) {
      await queryInterface.createTable("ga_item_instance", {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        item_def_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "ga_item_def", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        owner_user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "ga_user", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        bind_state: {
          type: Sequelize.ENUM("NONE", "ON_PICKUP", "SOULBOUND"),
          allowNull: false,
          defaultValue: "NONE",
        },
        durability: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        props_json: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex("ga_item_instance", ["item_def_id"], {
        name: "ga_item_instance_item_def_id",
      });
      await queryInterface.addIndex("ga_item_instance", ["owner_user_id"], {
        name: "ga_item_instance_owner_user_id",
      });
      await queryInterface.addIndex("ga_item_instance", ["bind_state"], {
        name: "ga_item_instance_bind_state",
      });
    }

    if (!(await tableExists(queryInterface, "ga_container"))) {
      await queryInterface.createTable("ga_container", {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        container_def_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "ga_container_def", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        slot_role: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        state: {
          type: Sequelize.ENUM("ACTIVE", "DISABLED"),
          allowNull: false,
          defaultValue: "ACTIVE",
        },
        rev: {
          type: Sequelize.BIGINT,
          allowNull: false,
          defaultValue: 1,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    if (!(await tableExists(queryInterface, "ga_container_slot"))) {
      await queryInterface.createTable("ga_container_slot", {
        container_id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          primaryKey: true,
          references: { model: "ga_container", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        slot_index: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
        },
        item_instance_id: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: "ga_item_instance", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        qty: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
      });
      await queryInterface.addIndex("ga_container_slot", ["container_id"], {
        name: "ga_container_slot_container_id",
      });
      await queryInterface.addIndex("ga_container_slot", ["item_instance_id"], {
        name: "ga_container_slot_item_instance_id",
        unique: true,
      });
    }
  },

  async down() {
    // No-op por seguranca. Esta migration existe para formalizar a criacao
    // de tabelas antigas que ja podem estar presentes em ambientes legados.
  },
};
