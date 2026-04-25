import { mergePos, mergeStatus, mergeVitals } from "./mergers";
import { normalizeEntity, toId } from "./normalizers";

export function applyBaseline(state, emitChange, payload) {
  if (!payload || payload.ok !== true) return;

  state.entities.clear();
  state.instanceId = payload.instanceId ?? null;
  state.chunk = payload.chunk ?? null;
  state.t = Number(payload.t ?? 0);

  const you = payload.you ?? null;
  let nextSelfId = null;
  let youEntity = null;

  if (typeof you === "string" || typeof you === "number") {
    nextSelfId = toId(you);
  } else if (you && typeof you === "object") {
    youEntity = normalizeEntity(you);
    if (youEntity) {
      nextSelfId = youEntity.entityId;
    }
  }

  const list = Array.isArray(payload.others)
    ? payload.others
    : Array.isArray(payload.entities)
      ? payload.entities
      : [];

  for (const raw of list) {
    const entity = normalizeEntity(raw);
    if (!entity) continue;
    if (nextSelfId && entity.entityId === nextSelfId) continue;
    state.entities.set(entity.entityId, entity);
  }

  if (nextSelfId != null) {
    state.selfId = nextSelfId;
  }

  if (youEntity) {
    const current = state.entities.get(youEntity.entityId);
    if (!current || youEntity.rev >= (current.rev ?? 0)) {
      state.entities.set(youEntity.entityId, youEntity);
    }
  }

  emitChange();
}

export function applySpawn(state, emitChange, entityRaw) {
  const entity = normalizeEntity(entityRaw);
  if (!entity) return;
  if (state.selfId && entity.entityId === state.selfId) return;

  const current = state.entities.get(entity.entityId);
  const currentRev = current?.rev ?? -1;
  if (!current || entity.rev > currentRev) {
    state.entities.set(entity.entityId, entity);
    emitChange();
  }
}

export function applyDespawn(state, emitChange, entityIdRaw) {
  const entityId = toId(entityIdRaw);
  if (!entityId) return;
  if (state.selfId && entityId === state.selfId) return;

  state.entities.delete(entityId);
  emitChange();
}

export function applyDelta(state, emitChange, delta) {
  if (!delta) return;

  const entityId = toId(delta.entityId ?? delta.id ?? delta.entity_id ?? null);
  if (!entityId) return;

  const nextRev = Number(delta.rev ?? NaN);
  if (!Number.isFinite(nextRev)) return;

  const current = state.entities.get(entityId);
  const currentRev = current?.rev ?? -1;
  if (nextRev <= currentRev) return;

  const base =
    current ??
    normalizeEntity({
      entityId,
      kind: delta.kind ?? null,
      displayName: null,
      pos: { x: 0, z: 0 },
      yaw: 0,
      hp: 0,
      vitals: {
        hp: { current: 0, max: 0 },
        stamina: { current: 0, max: 0 },
        hunger: { current: 0, max: 0 },
        thirst: { current: 0, max: 0 },
      },
      movement: null,
      action: "idle",
      rev: -1,
    });

  const nextHpCompat = delta.hp != null ? Number(delta.hp) : base.hp;
  const nextVitals = mergeVitals(base.vitals, delta, nextHpCompat);
  const nextStatus = mergeStatus(base.status, delta);

  const next = {
    ...base,
    rev: nextRev,
    kind: delta.kind != null ? delta.kind : base.kind,
    displayName:
      delta.displayName != null
        ? delta.displayName
        : delta.display_name != null
          ? delta.display_name
          : base.displayName,
    pos: mergePos(base.pos, delta.pos),
    yaw: delta.yaw != null ? Number(delta.yaw) : base.yaw,
    hp: nextHpCompat,
    vitals: nextVitals,
    status: nextStatus ?? base.status ?? null,
    movement: delta.movement != null ? delta.movement : base.movement ?? null,
    interact: delta.interact != null ? delta.interact : base.interact ?? null,
    action: delta.action != null ? delta.action : base.action,
    enemyDefCode:
      delta.enemyDefCode != null ? delta.enemyDefCode : base.enemyDefCode,
    enemyDefName:
      delta.enemyDefName != null ? delta.enemyDefName : base.enemyDefName,
    visualKind:
      delta.visualKind != null ? delta.visualKind : base.visualKind,
    assetKey: delta.assetKey != null ? delta.assetKey : base.assetKey,
    visualScale:
      delta.visualScale != null ? Number(delta.visualScale) : base.visualScale,
  };

  state.entities.set(entityId, next);
  emitChange();
}

export function applyVitalsDelta(state, emitChange, delta) {
  if (!delta) return;

  const entityId = toId(delta.entityId ?? delta.id ?? delta.entity_id ?? null);
  if (!entityId) return;

  const current = state.entities.get(entityId);
  if (!current) return;

  const nextHpCompat = delta.hp != null ? Number(delta.hp) : current.hp;
  const nextVitals = mergeVitals(current.vitals, delta, nextHpCompat);
  const nextStatus = mergeStatus(current.status, delta);

  const sameVitals =
    current.vitals?.hp?.current === nextVitals.hp.current &&
    current.vitals?.hp?.max === nextVitals.hp.max &&
    current.vitals?.stamina?.current === nextVitals.stamina.current &&
    current.vitals?.stamina?.max === nextVitals.stamina.max &&
    current.vitals?.hunger?.current === nextVitals.hunger.current &&
    current.vitals?.hunger?.max === nextVitals.hunger.max &&
    current.vitals?.thirst?.current === nextVitals.thirst.current &&
    current.vitals?.thirst?.max === nextVitals.thirst.max;

  const sameStatus = JSON.stringify(current.status ?? null) === JSON.stringify(nextStatus ?? null);
  if (sameVitals && sameStatus) return;

    state.entities.set(entityId, {
      ...current,
      hp: nextHpCompat,
      vitals: nextVitals,
      status: nextStatus ?? current.status ?? null,
      interact: current.interact ?? null,
    });
  emitChange();
}
