// server/state/runtime/constants.js

// Defaults
const DEFAULT_SPEED = 4;

// (NOVO) Janela para considerar WASD "ativo" sem depender de keyup.
// Se o client parar de emitir intents (perde foco, lag, etc), isso expira.
const INPUT_DIR_ACTIVE_MS = 250;

// Chunking (interest management)
const CHUNK_SIZE = 256; // configurável (Etapa 1: fixo)

// Connection states (string, não enum DB)
const CONNECTION = {
  CONNECTED: "CONNECTED",
  DISCONNECTED_PENDING: "DISCONNECTED_PENDING",
  OFFLINE: "OFFLINE",
};

module.exports = {
  DEFAULT_SPEED,
  INPUT_DIR_ACTIVE_MS,
  CHUNK_SIZE,
  CONNECTION,
};