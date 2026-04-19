import { debugIds, toId } from "../helpers";
import { normalizeSpawnedActor, patchSelfFromBaseline } from "./patches";

export function createWorldHandlers(state, requestInventoryFull, socket, store, mountedRef) {
  const onWorldObjectSpawn = (payload) => {
    const actor = payload?.actor ?? payload?.object ?? payload ?? null;
    const normalizedActor = normalizeSpawnedActor(actor, store);
    if (!normalizedActor) return;

    if (store?.applySpawn) {
      store.applySpawn(normalizedActor);
    }

    state.setSnapshot((prev) => {
      if (!prev) return prev;
      const actors = Array.isArray(prev.actors) ? prev.actors : [];
      if (actors.some((entry) => String(entry.id) === String(normalizedActor.id))) {
        return prev;
      }

      return {
        ...prev,
        actors: [...actors, normalizedActor],
      };
    });
  };

  const onSocketReady = (payload) => {
    if (payload?.ok !== true) return;

    socket.emit("world:join", {}, (ack) => {
      if (!mountedRef.current) return;
      if (ack?.ok === false) return;

      state.joinedRef.current = true;

      if (state.pendingInvRequestRef.current) {
        const ok = requestInventoryFull();
        if (ok) state.pendingInvRequestRef.current = false;
      }
    });
  };

  const onWorldBaseline = (payload) => {
    store.applyBaseline(payload);

    const selfId = toId(store.selfId);
    debugIds("baseline: selfId", selfId);
    if (!selfId) return;

    const self = store.entities.get(String(selfId));
    if (!self) return;

    state.setSnapshot((prev) => patchSelfFromBaseline(prev, payload, self));
  };

  return {
    onWorldObjectSpawn,
    onSocketReady,
    onWorldBaseline,
  };
}
