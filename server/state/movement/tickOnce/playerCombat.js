"use strict";

const { executeServerSideAttack } = require("./playerCombat/executeServerSideAttack");
const { processAutomaticCombat } = require("./playerCombat/automaticCombat");

module.exports = {
  executeServerSideAttack,
  processAutomaticCombat,
};
