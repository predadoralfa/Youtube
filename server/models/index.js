const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("./database");

// =====================================
// 1. Importação das Factories
// =====================================

// CORE
const defineGaUser = require("./ga_user");
const defineGaUserProfile = require("./ga_user_profile");
const defineGaUserStats = require("./ga_user_stats");
const defineGaUserRuntime = require("./ga_user_runtime");

// WORLD
const defineGaLocal = require("./ga_local");
const defineGaLocalGeometry = require("./ga_local_geometry");
const defineGaLocalVisual = require("./ga_local_visual");
const defineGaMaterial = require("./ga_material");
const defineGaInstance = require("./ga_instance");

// RENDER (NOVO)
const defineGaRenderMaterial = require("./ga_render_material");
const defineGaMeshTemplate = require("./ga_mesh_template");

// =====================================
// 2. Definições de modelos
// =====================================

// CORE MODELS
const GaUser = defineGaUser(sequelize, DataTypes);
const GaUserProfile = defineGaUserProfile(sequelize, DataTypes);
const GaUserStats = defineGaUserStats(sequelize, DataTypes);
const GaUserRuntime = defineGaUserRuntime(sequelize, DataTypes);

// WORLD MODELS
const GaLocal = defineGaLocal(sequelize, DataTypes);
const GaLocalGeometry = defineGaLocalGeometry(sequelize, DataTypes);
const GaLocalVisual = defineGaLocalVisual(sequelize, DataTypes);
const GaMaterial = defineGaMaterial(sequelize, DataTypes);

// INSTANCE MODELS
const GaInstance = defineGaInstance(sequelize, DataTypes);

// RENDER MODELS (NOVO)
const GaRenderMaterial = defineGaRenderMaterial(sequelize, DataTypes);
const GaMeshTemplate = defineGaMeshTemplate(sequelize, DataTypes);

// =====================================
// 3. Registry
// =====================================

const models = {
  GaUser,
  GaUserProfile,
  GaUserStats,
  GaUserRuntime,

  GaLocal,
  GaLocalGeometry,
  GaLocalVisual,
  GaMaterial,

  GaInstance,

  // RENDER (NOVO)
  GaRenderMaterial,
  GaMeshTemplate
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
