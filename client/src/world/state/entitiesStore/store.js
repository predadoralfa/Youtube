import {
  applyBaseline,
  applySpawn,
  applyDespawn,
  applyDelta,
  applyVitalsDelta,
} from "./mutations";

export function createEntitiesStore() {
  const state = {
    entities: new Map(),
    selfId: null,
    instanceId: null,
    chunk: null,
    t: 0,
    version: 0,
    listeners: new Set(),
  };

  function emitChange() {
    state.version += 1;
    for (const listener of state.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("[ENTITIES_STORE] listener error:", err);
      }
    }
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};

    state.listeners.add(listener);
    return () => {
      state.listeners.delete(listener);
    };
  }

  function clear() {
    state.entities.clear();
    state.selfId = null;
    state.instanceId = null;
    state.chunk = null;
    state.t = 0;
    emitChange();
  }

  function getSnapshot() {
    return Array.from(state.entities.values());
  }

  return {
    entities: state.entities,
    get selfId() {
      return state.selfId;
    },
    get instanceId() {
      return state.instanceId;
    },
    get chunk() {
      return state.chunk;
    },
    get t() {
      return state.t;
    },
    get version() {
      return state.version;
    },
    clear,
    applyBaseline(payload) {
      return applyBaseline(state, emitChange, payload);
    },
    applySpawn(entityRaw) {
      return applySpawn(state, emitChange, entityRaw);
    },
    applyDespawn(entityIdRaw) {
      return applyDespawn(state, emitChange, entityIdRaw);
    },
    applyDelta(delta) {
      return applyDelta(state, emitChange, delta);
    },
    applyVitalsDelta(delta) {
      return applyVitalsDelta(state, emitChange, delta);
    },
    subscribe,
    getSnapshot,
  };
}
