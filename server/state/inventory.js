"use strict";

const loader = require("./inventory/loader");
const store = require("./inventory/store");
const fullPayload = require("./inventory/fullPayload");
const weight = require("./inventory/weight");
const ops = {
  move: require("./inventory/ops/move"),
  split: require("./inventory/ops/split"),
  merge: require("./inventory/ops/merge"),
};
const persist = {
  flush: require("./inventory/persist/flush"),
};
const validate = {
  errors: require("./inventory/validate/errors"),
  rules: require("./inventory/validate/rules"),
};

module.exports = {
  loader,
  store,
  fullPayload,
  weight,
  ops,
  persist,
  validate,
  ...loader,
  ...store,
  ...fullPayload,
  ...weight,
};
