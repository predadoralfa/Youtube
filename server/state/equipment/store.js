"use strict";

const equipmentByUser = new Map();
const locksByUser = new Map();

function getEquipment(userId) {
  return equipmentByUser.get(String(userId)) || null;
}

function setEquipment(userId, equipment) {
  equipmentByUser.set(String(userId), equipment);
}

function clearEquipment(userId) {
  const key = String(userId);
  equipmentByUser.delete(key);
  locksByUser.delete(key);
}

async function withEquipmentLock(userId, fn) {
  const key = String(userId);
  const prev = locksByUser.get(key) || Promise.resolve();

  const run = prev
    .catch(() => {})
    .then(async () => {
      return await fn();
    });

  locksByUser.set(
    key,
    run.catch(() => {})
  );

  return run;
}

module.exports = {
  getEquipment,
  setEquipment,
  clearEquipment,
  withEquipmentLock,
};
