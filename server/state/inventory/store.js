// server/state/inventory/store.js
"use strict";

/**
 * Inventory store (in-memory)
 * - inventoryByUser: cache quente do runtime
 * - locksByUser: fila de execução por user (serializa mutações)
 *
 * Observações críticas:
 * - getInventory retorna null quando não existe
 * - markDirty assume inv.dirtyContainers como Set (crie no loader ao montar runtime)
 * - withInventoryLock PRECISA retornar o "run" (não prev.then(fn)), senão roda fn fora do lock
 */

const inventoryByUser = new Map(); // userId -> InventoryRuntime
const locksByUser = new Map(); // userId -> Promise tail

function getInventory(userId) {
  return inventoryByUser.get(String(userId)) || null;
}

function setInventory(userId, inv) {
  inventoryByUser.set(String(userId), inv);
}

function getAllInventories() {
  return Array.from(inventoryByUser.values());
}

function clearInventory(userId) {
  const key = String(userId);
  inventoryByUser.delete(key);
  locksByUser.delete(key);
}

function markDirty(userId, containerId) {
  const inv = getInventory(userId);
  if (!inv) return;

  // defensivo: garante Set
  if (!inv.dirtyContainers || typeof inv.dirtyContainers.add !== "function") {
    inv.dirtyContainers = new Set();
  }

  inv.dirtyContainers.add(String(containerId));
}

/**
 * withInventoryLock(userId, fn)
 * Serializa execuções por usuário:
 * - todas as mutações/flush devem passar aqui
 * - garante ordem e evita corrida entre inv:move / inv:split / inv:merge
 */
async function withInventoryLock(userId, fn) {
  const key = String(userId);
  const prev = locksByUser.get(key) || Promise.resolve();

  // "run" é a execução do slot atual na fila
  const run = prev
    .catch(() => {}) // não deixa erro antigo quebrar a cadeia
    .then(async () => {
      return await fn();
    });

  // atualiza a cauda: sempre aponta pro término do "run"
  locksByUser.set(
    key,
    run.catch(() => {}) // mantém cadeia viva mesmo se esse run falhar
  );

  return run;
}

module.exports = {
  getInventory,
  getAllInventories,
  setInventory,
  clearInventory,
  markDirty,
  withInventoryLock,
};
