const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("./database");

// =====================================
// 1. Importação das Factories
// =====================================

//CORE IMPORTS
const defineGaUser = require('./ga_user');
const defineGaUserProfile = require('./ga_user_profile')


//======================================
// 2. Definições de modelos
// =====================================

//CORE MODELS
const GaUser = defineGaUser(sequelize, DataTypes);
const GaUserProfile = defineGaUserProfile(sequelize, DataTypes);


//REGISTRY
const models = {
    GaUser,
    GaUserProfile,

};


// Associations (depois que todos existem)
Object.values(models).forEach((model) => {
  if (typeof model.associate === "function") {
    model.associate(models);
  }
});


//exportações
module.exports = { sequelize, Sequelize, ...models };