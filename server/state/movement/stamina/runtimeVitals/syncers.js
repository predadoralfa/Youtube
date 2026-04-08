"use strict";

const { toFiniteNumber } = require("../shared");

function syncRuntimeHp(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 0);
  const nextMax = toFiniteNumber(max, 0);

  rt.hpCurrent = nextCurrent;
  rt.hpMax = nextMax;
  rt.hp = nextCurrent;

  if (!rt.vitals) rt.vitals = {};
  if (!rt.vitals.hp) rt.vitals.hp = { current: nextCurrent, max: nextMax };
  rt.vitals.hp.current = nextCurrent;
  rt.vitals.hp.max = nextMax;

  if (!rt.combat) rt.combat = {};
  rt.combat.hpCurrent = nextCurrent;
  rt.combat.hpMax = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.hpCurrent = nextCurrent;
  rt.stats.hpMax = nextMax;
}

function syncRuntimeStamina(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 0);
  const nextMax = toFiniteNumber(max, 0);

  rt.staminaCurrent = nextCurrent;
  rt.staminaMax = nextMax;

  if (!rt.vitals) rt.vitals = {};
  if (!rt.vitals.stamina) rt.vitals.stamina = { current: nextCurrent, max: nextMax };
  rt.vitals.stamina.current = nextCurrent;
  rt.vitals.stamina.max = nextMax;

  if (!rt.combat) rt.combat = {};
  rt.combat.staminaCurrent = nextCurrent;
  rt.combat.staminaMax = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.staminaCurrent = nextCurrent;
  rt.stats.staminaMax = nextMax;
}

function syncRuntimeHunger(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 0);
  const nextMax = toFiniteNumber(max, 0);

  rt.hungerCurrent = nextCurrent;
  rt.hungerMax = nextMax;

  if (!rt.vitals) rt.vitals = {};
  if (!rt.vitals.hunger) rt.vitals.hunger = { current: nextCurrent, max: nextMax };
  rt.vitals.hunger.current = nextCurrent;
  rt.vitals.hunger.max = nextMax;

  if (!rt.combat) rt.combat = {};
  rt.combat.hungerCurrent = nextCurrent;
  rt.combat.hungerMax = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.hungerCurrent = nextCurrent;
  rt.stats.hungerMax = nextMax;
}

module.exports = {
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeHunger,
};
