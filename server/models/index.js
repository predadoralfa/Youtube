const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("./database");

// =====================================
// 1. Importação das Factories
// =====================================

// CORE
const defineGaEraDef = require("./ga_era_def");
const defineGaUser = require("./ga_user");
const defineGaUserProfile = require("./ga_user_profile");
const defineGaUserStats = require("./ga_user_stats");
const defineGaUserRuntime = require("./ga_user_runtime");
const defineGaUserMacroConfig = require("./ga_user_macro_config");

// SPAWN
const defineGaSpawnEntry = require("./ga_spawn_entry");
const defineGaSpawnPoint = require("./ga_spawn_point");

// ENEMY
const defineGaEnemyDef = require("./ga_enemy_def");
const defineGaEnemyDefStats = require("./ga_enemy_def_stats");
const defineGaEnemyInstance = require("./ga_enemy_instance");
const defineGaEnemyInstanceStats = require("./ga_enemy_instance_stats");


// WORLD
const defineGaLocal = require("./ga_local");
const defineGaLocalGeometry = require("./ga_local_geometry");
const defineGaLocalVisual = require("./ga_local_visual");
const defineGaMaterial = require("./ga_material");
const defineGaInstance = require("./ga_instance");
const defineGaWorldClock = require("./ga_world_clock");
const defineGaWorldMonthDef = require("./ga_world_month_def");

// RENDER (NOVO)
const defineGaRenderMaterial = require("./ga_render_material");
const defineGaMeshTemplate = require("./ga_mesh_template");

// NOVOS (ITEM)
const defineGaItemDef = require("./ga_item_def");
const defineGaItemDefComponent = require("./ga_item_def_component");
const defineGaItemInstance = require("./ga_item_instance");

// NOVOS (EQUIPMENT)
const defineGaEquipmentSlotDef = require("./ga_equipment_slot_def");
const defineGaEquippedItem = require("./ga_equipped_item");

// NOVOS (INVENTORY)
const defineGaContainerDef = require("./ga_container_def");
const defineGaContainer = require("./ga_container");
const defineGaContainerSlot = require("./ga_container_slot");
const defineGaContainerOwner = require("./ga_container_owner");

// ACTORS
const defineGaActor = require("./ga_actor");

// =====================================
// 2. Definições de modelos
// =====================================

// CORE MODELS
const GaEraDef = defineGaEraDef(sequelize, DataTypes);
const GaUser = defineGaUser(sequelize, DataTypes);
const GaUserProfile = defineGaUserProfile(sequelize, DataTypes);
const GaUserStats = defineGaUserStats(sequelize, DataTypes);
const GaUserRuntime = defineGaUserRuntime(sequelize, DataTypes);
const GaUserMacroConfig = defineGaUserMacroConfig(sequelize, DataTypes);

// SPAWN MODELS
const GaSpawnEntry = defineGaSpawnEntry(sequelize, DataTypes);
const GaSpawnPoint = defineGaSpawnPoint(sequelize, DataTypes);

// ENEMY MODELS
const GaEnemyDef = defineGaEnemyDef(sequelize, DataTypes);
const GaEnemyDefStats = defineGaEnemyDefStats(sequelize, DataTypes);
const GaEnemyInstance = defineGaEnemyInstance(sequelize, DataTypes);
const GaEnemyInstanceStats = defineGaEnemyInstanceStats(sequelize, DataTypes);

// WORLD MODELS
const GaLocal = defineGaLocal(sequelize, DataTypes);
const GaLocalGeometry = defineGaLocalGeometry(sequelize, DataTypes);
const GaLocalVisual = defineGaLocalVisual(sequelize, DataTypes);
const GaMaterial = defineGaMaterial(sequelize, DataTypes);

// INSTANCE MODELS
const GaInstance = defineGaInstance(sequelize, DataTypes);
const GaWorldClock = defineGaWorldClock(sequelize, DataTypes);
const GaWorldMonthDef = defineGaWorldMonthDef(sequelize, DataTypes);

// RENDER MODELS (NOVO)
const GaRenderMaterial = defineGaRenderMaterial(sequelize, DataTypes);
const GaMeshTemplate = defineGaMeshTemplate(sequelize, DataTypes);

// ITENS
const GaItemDef = defineGaItemDef(sequelize, DataTypes);
const GaItemDefComponent = defineGaItemDefComponent(sequelize, DataTypes);
const GaItemInstance = defineGaItemInstance(sequelize, DataTypes);

// EQUIPMENT
const GaEquipmentSlotDef = defineGaEquipmentSlotDef(sequelize, DataTypes);
const GaEquippedItem = defineGaEquippedItem(sequelize, DataTypes);

//CONTEINERS
const GaContainerDef = defineGaContainerDef(sequelize, DataTypes);
const GaContainer = defineGaContainer(sequelize, DataTypes);
const GaContainerSlot = defineGaContainerSlot(sequelize, DataTypes);
const GaContainerOwner = defineGaContainerOwner(sequelize, DataTypes);

// ACTORS
const GaActor = defineGaActor(sequelize, DataTypes);


// =====================================
// 3. Registry
// =====================================

const models = {
  // CORE
  GaEraDef,

  // SPAWN
  GaSpawnEntry,
  GaSpawnPoint,

  // ENEMY
  GaEnemyDef,
  GaEnemyDefStats,
  GaEnemyInstance,
  GaEnemyInstanceStats,

  // USER
  GaUser,
  GaUserProfile,
  GaUserStats,
  GaUserRuntime,
  GaUserMacroConfig,

  // ACTOR
  GaActor,

  // WORLD
  GaLocal,
  GaLocalGeometry,
  GaLocalVisual,
  GaMaterial,

  // INSTANCE
  GaInstance,
  GaWorldClock,
  GaWorldMonthDef,

  // RENDER (NOVO)
  GaRenderMaterial,
  GaMeshTemplate,

  // ITEM
  GaItemDef,
  GaItemDefComponent,
  GaItemInstance,

  // EQUIPMENT
  GaEquipmentSlotDef,
  GaEquippedItem,

  // CONTAINER
  GaContainerDef,
  GaContainer,
  GaContainerSlot,
  GaContainerOwner,
  
};

// =====================================
// 4. Associations (depois que todos existem)
// =====================================

Object.values(models).forEach((model) => {
  if (typeof model.associate === "function") {
    model.associate(models);
  }
});

// =====================================
// 5. Exportações
// =====================================

module.exports = { sequelize, Sequelize, ...models };
