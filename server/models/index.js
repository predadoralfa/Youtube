const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("./database");

// =====================================
// 1. Importação das Factories
// =====================================

//CORE
const defineUser = require('./user');


//======================================
// 2. Definições de modelos
// =====================================

//CORE
const User = defineUser(sequelize, DataTypes);


const models = { User };

//exportações

module.exports = { sequelize, Sequelize, ...models };