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

//INSTANCE MODELS
const GaInstance = defineGaInstance(sequelize, DataTypes);


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
