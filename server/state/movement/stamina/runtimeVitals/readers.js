"use strict";

const { toFiniteNumber } = require("../shared");

function readRuntimeStaminaCurrent(rt) {
  return toFiniteNumber(
    rt?.staminaCurrent ??
      rt?.stamina_current ??
      rt?.stats?.staminaCurrent ??
      rt?.stats?.stamina_current ??
      rt?.combat?.staminaCurrent ??
      rt?.combat?.stamina_current,
    0
  );
}

function readRuntimeStaminaMax(rt) {
  return toFiniteNumber(
    rt?.staminaMax ??
      rt?.stamina_max ??
      rt?.stats?.staminaMax ??
      rt?.stats?.stamina_max ??
      rt?.combat?.staminaMax ??
      rt?.combat?.stamina_max,
    0
  );
}

function readRuntimeHpCurrent(rt) {
  return toFiniteNumber(
    rt?.hpCurrent ??
      rt?.hp_current ??
      rt?.vitals?.hp?.current ??
      rt?.combat?.hpCurrent ??
      rt?.combat?.hp_current ??
      rt?.stats?.hpCurrent ??
      rt?.stats?.hp_current ??
      rt?.hp,
    0
  );
}

function readRuntimeHpMax(rt) {
  return toFiniteNumber(
    rt?.hpMax ??
      rt?.hp_max ??
      rt?.vitals?.hp?.max ??
      rt?.combat?.hpMax ??
      rt?.combat?.hp_max ??
      rt?.stats?.hpMax ??
      rt?.stats?.hp_max,
    0
  );
}

function readRuntimeHungerCurrent(rt) {
  return toFiniteNumber(
    rt?.hungerCurrent ??
      rt?.hunger_current ??
      rt?.vitals?.hunger?.current ??
      rt?.combat?.hungerCurrent ??
      rt?.combat?.hunger_current ??
      rt?.stats?.hungerCurrent ??
      rt?.stats?.hunger_current,
    0
  );
}

function readRuntimeHungerMax(rt) {
  return toFiniteNumber(
    rt?.hungerMax ??
      rt?.hunger_max ??
      rt?.vitals?.hunger?.max ??
      rt?.combat?.hungerMax ??
      rt?.combat?.hunger_max ??
      rt?.stats?.hungerMax ??
      rt?.stats?.hunger_max,
    0
  );
}

module.exports = {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
};
