// cliente/src/World/state/entitiesStore.js
// Store autoritativo de entidades replicadas (baseline/spawn/delta/despawn).
// - NÃƒÂ£o depende de React.
// - Controla rev (monotÃƒÂ´nico por entityId).
// - Baseline ÃƒÂ© verdade completa do interesse atual.
//
// Ã¢Å“â€¦ AtualizaÃƒÂ§ÃƒÂµes:
// - Normaliza entityId/selfId sempre para string (evita bug 1 vs "1").
// - Baseline compatÃƒÂ­vel com payload.entities (legado) e payload.others (novo).
// - applyDelta/applyDespawn normalizam id antes de acessar Map.

function toId(raw) {
  if (raw == null) return null;
  return String(raw);
}

// FIX: debug opcional para verificar normalizaÃƒÂ§ÃƒÂ£o de IDs (desativado por padrÃƒÂ£o)
const DEBUG_IDS = false;
function debugIds(...args) {
  if (!DEBUG_IDS) return;
  console.log("[ENTITIES_STORE][IDS]", ...args);
}

function normalizeEntity(raw) {
  if (!raw) return null;

  const entityId = toId(raw.entityId ?? raw.id ?? raw.entity_id ?? null);
  if (!entityId) return null;

  const posRaw = raw.pos ?? raw.position ?? null;

  const pos = posRaw
    ? {
        x: Number(posRaw.x ?? 0),
        y: posRaw.y != null ? Number(posRaw.y) : undefined,
        z: Number(posRaw.z ?? 0),
      }
    : { x: 0, y: undefined, z: 0 };

  const entity = {
    entityId,
    displayName: raw.displayName ?? raw.display_name ?? null,
    pos,
    yaw: Number(raw.yaw ?? 0),
    hp: Number(raw.hp ?? 0),
    action: raw.action ?? "idle",
    rev: Number(raw.rev ?? 0),
  };

  return entity;
}

function mergePos(oldPos, newPos) {
  if (!newPos) return oldPos;
  return {
    x: newPos.x != null ? Number(newPos.x) : oldPos.x,
    y: newPos.y != null ? Number(newPos.y) : oldPos.y,
    z: newPos.z != null ? Number(newPos.z) : oldPos.z,
  };
}

export function createEntitiesStore() {
  const state = {
    entities: new Map(), // entityId(string) -> Entity
    selfId: null, // string
    instanceId: null,
    chunk: null, // {cx,cz}
    t: 0,
  };

  function clear() {
    state.entities.clear();
    state.selfId = null;
    state.instanceId = null;
    state.chunk = null;
    state.t = 0;
  }

  function applyBaseline(payload) {
    // Baseline sempre vence: troca completa do estado replicado.
    if (!payload || payload.ok !== true) return;

    state.entities.clear();

    state.instanceId = payload.instanceId ?? null;
    state.chunk = payload.chunk ?? null;
    state.t = Number(payload.t ?? 0);

    // FIX: normaliza selfId ANTES de inserir others, para evitar "self como other"
    const you = payload.you ?? null;
    let nextSelfId = null;
    let youEntity = null;

    if (typeof you === "string" || typeof you === "number") {
      nextSelfId = toId(you);
      debugIds("baseline: selfId set (primitive)", nextSelfId);
    } else if (you && typeof you === "object") {
      youEntity = normalizeEntity(you);
      if (youEntity) {
        nextSelfId = youEntity.entityId;
        debugIds("baseline: selfId set (entity)", nextSelfId);
      }
    }

    // FIX: compat: baseline pode vir como { others } (novo) ou { entities } (legado)
    const list = Array.isArray(payload.others)
      ? payload.others
      : Array.isArray(payload.entities)
        ? payload.entities
        : [];

    for (const raw of list) {
      const e = normalizeEntity(raw);
      if (!e) continue;
      // FIX: evita inserir self como "other" se vier indevidamente no baseline
      if (nextSelfId && e.entityId === nextSelfId) {
        debugIds("baseline: skip self in others", e.entityId);
        continue;
      }
      state.entities.set(e.entityId, e);
    }

    // FIX: aplica selfId normalizado (string) no estado
    // FIX: se baseline nÃ£o enviar "you", mantÃ©m selfId anterior para evitar null/ownership swap
    if (nextSelfId == null) {
      debugIds("baseline: missing you, keep selfId", state.selfId);
    } else {
      state.selfId = nextSelfId;
    }

    // FIX: garante presenÃƒÂ§a do self mesmo se baseline nÃƒÂ£o listar self em "others"
    if (youEntity) {
      const current = state.entities.get(youEntity.entityId);
      if (!current || youEntity.rev >= (current.rev ?? 0)) {
        state.entities.set(youEntity.entityId, youEntity);
      }
    }
  }

  function applySpawn(entityRaw) {
    const e = normalizeEntity(entityRaw);
    if (!e) return;

    // FIX: evita tratar self como "other" em spawn
    if (state.selfId && e.entityId === state.selfId) {
      debugIds("spawn: skip self", e.entityId);
      return;
    }

    const cur = state.entities.get(e.entityId);
    const curRev = cur?.rev ?? -1;

    // SÃƒÂ³ aplica se rev for maior (ou se nÃƒÂ£o existir)
    if (!cur || e.rev > curRev) {
      state.entities.set(e.entityId, e);
    }
  }

  function applyDespawn(entityIdRaw) {
    const entityId = toId(entityIdRaw);
    if (!entityId) return;
    // FIX: evita despawn do self por acidente
    if (state.selfId && entityId === state.selfId) {
      debugIds("despawn: skip self", entityId);
      return;
    }
    state.entities.delete(entityId);
  }

  function applyDelta(delta) {
    if (!delta) return;

    const entityId = toId(delta.entityId ?? delta.id ?? delta.entity_id ?? null);
    if (!entityId) return;

    debugIds("delta: normalized id", entityId);

    const nextRev = Number(delta.rev ?? NaN);
    if (!Number.isFinite(nextRev)) return;

    const cur = state.entities.get(entityId);
    const curRev = cur?.rev ?? -1;

    // Regra obrigatÃƒÂ³ria: sÃƒÂ³ aplica se rev maior
    if (nextRev <= curRev) return;

    // Se nÃƒÂ£o existe ainda, cria com defaults e aplica delta
    const base =
      cur ??
      normalizeEntity({
        entityId,
        displayName: null,
        pos: { x: 0, z: 0 },
        yaw: 0,
        hp: 0,
        action: "idle",
        rev: -1,
      });

    const next = {
      ...base,
      rev: nextRev,
      pos: mergePos(base.pos, delta.pos),
      yaw: delta.yaw != null ? Number(delta.yaw) : base.yaw,
      hp: delta.hp != null ? Number(delta.hp) : base.hp,
      action: delta.action != null ? delta.action : base.action,
    };

    state.entities.set(entityId, next);
  }

  function getSnapshot() {
    // Render-friendly: array estÃƒÂ¡vel (sem expor o Map)
    return Array.from(state.entities.values());
  }

  return {
    // estado (somente leitura via referÃƒÂªncia)
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

    // mutaÃƒÂ§ÃƒÂµes
    clear,
    applyBaseline,
    applySpawn,
    applyDespawn,
    applyDelta,

    // leitura
    getSnapshot,
  };
}
