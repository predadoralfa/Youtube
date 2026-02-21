// server/state/runtime/store.js

const runtimeStore = new Map(); // key: String(userId) -> runtime state

function getRuntime(userId) {
  return runtimeStore.get(String(userId)) || null;
}

function setRuntime(userId, runtime) {
  runtimeStore.set(String(userId), runtime);
}

/**
 * Útil para debug e para o persistenceManager decidir eviction.
 */
function hasRuntime(userId) {
  return runtimeStore.has(String(userId));
}

/**
 * Eviction explícita do runtime em memória.
 * Retorna true se removeu, false se não existia.
 */
function deleteRuntime(userId) {
  return runtimeStore.delete(String(userId));
}

/**
 * Iterador seguro para o persistenceManager varrer.
 * Não expõe o Map diretamente.
 */
function getAllRuntimes() {
  return runtimeStore.values();
}

module.exports = {
  getRuntime,
  setRuntime,
  hasRuntime,
  deleteRuntime,
  getAllRuntimes,
};