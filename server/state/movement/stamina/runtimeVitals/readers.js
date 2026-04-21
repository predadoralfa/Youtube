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

function readRuntimeThirstCurrent(rt) {
  return toFiniteNumber(
    rt?.thirstCurrent ??
      rt?.thirst_current ??
      rt?.vitals?.thirst?.current ??
      rt?.combat?.thirstCurrent ??
      rt?.combat?.thirst_current ??
      rt?.stats?.thirstCurrent ??
      rt?.stats?.thirst_current,
    0
  );
}

function readRuntimeThirstMax(rt) {
  return toFiniteNumber(
    rt?.thirstMax ??
      rt?.thirst_max ??
      rt?.vitals?.thirst?.max ??
      rt?.combat?.thirstMax ??
      rt?.combat?.thirst_max ??
      rt?.stats?.thirstMax ??
      rt?.stats?.thirst_max,
    0
  );
}

function readRuntimeImmunityCurrent(rt) {
  return toFiniteNumber(
    rt?.immunityCurrent ??
      rt?.immunity_current ??
      rt?.status?.immunity?.current ??
      rt?.stats?.immunityCurrent ??
      rt?.stats?.immunity_current,
    100
  );
}

function readRuntimeImmunityMax(rt) {
  return toFiniteNumber(
    rt?.immunityMax ??
      rt?.immunity_max ??
      rt?.status?.immunity?.max ??
      rt?.stats?.immunityMax ??
      rt?.stats?.immunity_max,
    100
  );
}

function readRuntimeImmunityPercent(rt) {
  return toFiniteNumber(
    rt?.immunityPercent ??
      rt?.immunity_percent ??
      rt?.status?.immunity?.percent ??
      rt?.stats?.immunityPercent ??
      rt?.stats?.immunity_percent,
    Math.round((readRuntimeImmunityCurrent(rt) / Math.max(1, readRuntimeImmunityMax(rt))) * 100000) / 1000
  );
}

function readRuntimeDiseaseLevel(rt) {
  return toFiniteNumber(
    rt?.diseaseLevel ??
      rt?.disease_level ??
      rt?.status?.disease?.current ??
      rt?.status?.disease?.level ??
      rt?.status?.fever?.current ??
      rt?.stats?.diseaseLevel ??
      rt?.stats?.disease_level,
    100
  );
}

function readRuntimeDiseaseSeverity(rt) {
  return toFiniteNumber(
    rt?.diseaseSeverity ??
      rt?.disease_severity ??
      rt?.status?.disease?.severity ??
      rt?.status?.fever?.severity ??
      rt?.stats?.diseaseSeverity ??
      rt?.stats?.disease_severity,
    0
  );
}

function readRuntimeSleepCurrent(rt) {
  return toFiniteNumber(
    rt?.sleepCurrent ??
      rt?.sleep_current ??
      rt?.status?.sleep?.current ??
      rt?.stats?.sleepCurrent ??
      rt?.stats?.sleep_current,
    100
  );
}

function readRuntimeSleepMax(rt) {
  return toFiniteNumber(
    rt?.sleepMax ??
      rt?.sleep_max ??
      rt?.status?.sleep?.max ??
      rt?.stats?.sleepMax ??
      rt?.stats?.sleep_max,
    100
  );
}

module.exports = {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  readRuntimeThirstCurrent,
  readRuntimeThirstMax,
  readRuntimeImmunityCurrent,
  readRuntimeImmunityMax,
  readRuntimeImmunityPercent,
  readRuntimeDiseaseLevel,
  readRuntimeDiseaseSeverity,
  readRuntimeSleepCurrent,
  readRuntimeSleepMax,
};
