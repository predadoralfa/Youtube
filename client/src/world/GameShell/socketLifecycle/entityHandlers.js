import { disconnectSocket } from "@/services/Socket";
import { debugIds, normalizeVitals, toId } from "../helpers";
import {
  patchEnemyAttack,
  patchSelfFromEntityDelta,
  patchSelfFromMoveState,
  patchSelfVitalsOnly,
} from "./patches";

export function createEntityHandlers(state, store) {
  const onEntitySpawn = (payload) => {
    let entity = payload?.entity ?? payload;
    const entityId = toId(entity?.entityId ?? entity?.id ?? entity?.entity_id ?? null);

    if (entityId && String(entityId) === String(store.selfId)) {
      debugIds("spawn: skip self", entityId);
      return;
    }

    if (entity && typeof entity === "object" && entityId) {
      entity = { ...entity, entityId };
    }

    store.applySpawn(entity);
  };

  const onEntityDespawn = (payload) => {
    const entityId = toId(payload?.entityId ?? payload?.id ?? payload);

    if (entityId && String(entityId) === String(store.selfId)) {
      debugIds("despawn: skip self", entityId);
      return;
    }

    store.applyDespawn(entityId);
  };

  const onEntityDelta = (payload) => {
    store.applyDelta(payload);

    const selfId = toId(store.selfId);
    if (!selfId) return;

    const entityId = toId(payload?.entityId ?? payload?.id ?? payload?.entity_id ?? null);
    if (!entityId || String(entityId) !== String(selfId)) return;

    const self = store.entities.get(String(selfId));
    if (!self) return;

    state.setSnapshot((prev) => patchSelfFromEntityDelta(prev, self));
  };

  const onMoveState = (payload) => {
    state.setSnapshot((prev) => patchSelfFromMoveState(prev, payload));

    const selfId = toId(payload?.entityId ?? store.selfId);
    if (!selfId) return;

    const rev = payload?.rev;
    if (rev == null) return;

    store.applyDelta({
      entityId: String(selfId),
      rev,
      pos: payload?.pos,
      yaw: payload?.yaw,
      hp: payload?.hp,
      vitals: payload?.vitals,
      status: payload?.status,
      action: payload?.action,
    });

    const self = store.entities.get(String(selfId));
    if (!self) return;

    const nextVitals = payload?.vitals
      ? normalizeVitals({ vitals: payload.vitals })
      : normalizeVitals(self);

    state.setSnapshot((prev) => patchSelfVitalsOnly(prev, nextVitals));
  };

  const onSessionReplaced = (payload) => {
    state.setSessionReplaced(payload ?? { reason: "session_replaced" });

    try {
      const socket = state.socketRef.current;
      if (socket) socket.removeAllListeners();
    } catch {}

    disconnectSocket();
    state.socketRef.current = null;
    store.clear();
  };

  const onConnectError = (err) => {
    console.error("[SOCKET] connect_error:", err?.message || err);
  };

  const onEnemyAttack = (payload) => {
    state.setSnapshot((prev) => patchEnemyAttack(prev, payload));
  };

  return {
    onEntitySpawn,
    onEntityDespawn,
    onEntityDelta,
    onMoveState,
    onSessionReplaced,
    onConnectError,
    onEnemyAttack,
  };
}
