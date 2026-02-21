// server/state/persistence/events.js
const EventEmitter = require("events");

// Eventos internos do runtime/persistência (não depende de socket.io)
const persistenceEvents = new EventEmitter();

/**
 * API de assinatura para o layer de socket/broadcast (sem acoplamento)
 * Ex: onEntityDespawn((evt) => { ... broadcast ... })
 */
function onEntityDespawn(handler) {
  persistenceEvents.on("entity:despawn", handler);
}

module.exports = {
  persistenceEvents,
  onEntityDespawn,
};