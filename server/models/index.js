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
const defineGaResearchDef = require("./ga_research_def");
const defineGaResearchLevelDef = require("./ga_research_level_def");
const defineGaUserResearch = require("./ga_user_research");
const defineGaActorResourceRuleDef = require("./ga_actor_resource_rule_def");
const defineGaActorResourceState = require("./ga_actor_resource_state");

// SPAWN
const defineGaSpawnDef = require("./ga_spawn_def");
const defineGaSpawnDefComponent = require("./ga_spawn_def_component");
const defineGaSpawnInstance = require("./ga_spawn_instance");

// ENEMY
const defineGaEnemyDef = require("./ga_enemy_def");
const defineGaEnemyDefStats = require("./ga_enemy_def_stats");
const defineGaEnemyRuntime = require("./ga_enemy_runtime");
const defineGaEnemyRuntimeStats = require("./ga_enemy_runtime_stats");


// WORLD
const defineGaLocal = require("./ga_local");
const defineGaLocalGeometry = require("./ga_local_geometry");
const defineGaLocalVisual = require("./ga_local_visual");
const defineGaMaterial = require("./ga_material");
const defineGaInstance = require("./ga_instance");
const defineGaWorldClock = require("./ga_world_clock");
const defineGaWorldMonthDef = require("./ga_world_month_def");
const defineGaInstanceSpawnConfig = require("./ga_instance_spawn_config");

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
const defineGaActorDef = require("./ga_actor_def");
const defineGaActorSpawn = require("./ga_actor_spawn");
const defineGaActorRuntime = require("./ga_actor_runtime");

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
const GaResearchDef = defineGaResearchDef(sequelize, DataTypes);
const GaResearchLevelDef = defineGaResearchLevelDef(sequelize, DataTypes);
const GaUserResearch = defineGaUserResearch(sequelize, DataTypes);
const GaActorResourceRuleDef = defineGaActorResourceRuleDef(sequelize, DataTypes);
const GaActorResourceState = defineGaActorResourceState(sequelize, DataTypes);

// SPAWN MODELS
const GaSpawnDef = defineGaSpawnDef(sequelize, DataTypes);
const GaSpawnDefComponent = defineGaSpawnDefComponent(sequelize, DataTypes);
const GaSpawnInstance = defineGaSpawnInstance(sequelize, DataTypes);

// ENEMY MODELS
const GaEnemyDef = defineGaEnemyDef(sequelize, DataTypes);
const GaEnemyDefStats = defineGaEnemyDefStats(sequelize, DataTypes);
const GaEnemyRuntime = defineGaEnemyRuntime(sequelize, DataTypes);
const GaEnemyRuntimeStats = defineGaEnemyRuntimeStats(sequelize, DataTypes);

// WORLD MODELS
const GaLocal = defineGaLocal(sequelize, DataTypes);
const GaLocalGeometry = defineGaLocalGeometry(sequelize, DataTypes);
const GaLocalVisual = defineGaLocalVisual(sequelize, DataTypes);
const GaMaterial = defineGaMaterial(sequelize, DataTypes);

// INSTANCE MODELS
const GaInstance = defineGaInstance(sequelize, DataTypes);
const GaWorldClock = defineGaWorldClock(sequelize, DataTypes);
const GaWorldMonthDef = defineGaWorldMonthDef(sequelize, DataTypes);
const GaInstanceSpawnConfig = defineGaInstanceSpawnConfig(sequelize, DataTypes);

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
const GaActorDef = defineGaActorDef(sequelize, DataTypes);
const GaActorSpawn = defineGaActorSpawn(sequelize, DataTypes);
const GaActorRuntime = defineGaActorRuntime(sequelize, DataTypes);


// =====================================
// 3. Registry
// =====================================

const models = {
  // CORE
  GaEraDef,

  // SPAWN
  GaSpawnDef,
  GaSpawnDefComponent,
  GaSpawnInstance,

  // ENEMY
  GaEnemyDef,
  GaEnemyDefStats,
  GaEnemyRuntime,
  GaEnemyRuntimeStats,

  // USER
  GaUser,
  GaUserProfile,
  GaUserStats,
  GaUserRuntime,
  GaUserMacroConfig,
  GaResearchDef,
  GaResearchLevelDef,
  GaUserResearch,
  GaActorResourceRuleDef,
  GaActorResourceState,

  // ACTOR
  GaActorDef,
  GaActorSpawn,
  GaActorRuntime,

  // WORLD
  GaLocal,
  GaLocalGeometry,
  GaLocalVisual,
  GaMaterial,

  // INSTANCE
  GaInstance,
  GaInstanceSpawnConfig,
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
