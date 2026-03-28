// cliente/src/World/state/entitiesStore.js
// Store autoritativo de entidades replicadas (baseline/spawn/delta/despawn).
// - Não depende de React.
// - Controla rev (monotônico por entityId).
// - Baseline é verdade completa do interesse atual.
//
// Atualizações:
// - Normaliza entityId/selfId sempre para string (evita bug 1 vs "1").
// - Baseline compatível com payload.entities (legado) e payload.others (novo).
// - applyDelta/applyDespawn normalizam id antes de acessar Map.
// - Preserva kind e vitals (hp/stamina) para HUD e barras.

function toId(raw) {
  if (raw == null) return null;
  return String(raw);
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// FIX: debug opcional para verificar normalização de IDs (desativado por padrão)
const DEBUG_IDS = false;
function debugIds(...args) {
  if (!DEBUG_IDS) return;
  console.log("[ENTITIES_STORE][IDS]", ...args);
}

function normalizeVitals(raw) {
  const vitals = raw?.vitals ?? null;
  const stats = raw?.stats ?? null;

  const hpCurrent = vitals?.hp?.current ?? raw?.hp ?? stats?.hpCurrent ?? stats?.hp_current;
  const hpMax = vitals?.hp?.max ?? raw?.hpMax ?? raw?.hp_max ?? stats?.hpMax ?? stats?.hp_max;

  const staminaCurrent =
    vitals?.stamina?.current ??
    raw?.staminaCurrent ??
    raw?.stamina_current ??
    stats?.staminaCurrent ??
    stats?.stamina_current;

  const staminaMax =
    vitals?.stamina?.max ??
    raw?.staminaMax ??
    raw?.stamina_max ??
    stats?.staminaMax ??
    stats?.stamina_max;

  return {
    hp: {
      current: toNum(hpCurrent, 0),
      max: toNum(hpMax, 0),
    },
    stamina: {
      current: toNum(staminaCurrent, 0),
      max: toNum(staminaMax, 0),
    },
  };
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

  const vitals = normalizeVitals(raw);

  const entity = {
    entityId,
    kind: raw.kind ?? null,
    displayName: raw.displayName ?? raw.display_name ?? null,
    pos,
    yaw: Number(raw.yaw ?? 0),

    // compat legado
    hp: toNum(raw.hp ?? vitals.hp.current, 0),

    vitals,
    action: raw.action ?? "idle",
    rev: Number(raw.rev ?? 0),
  };

  return entity;
}

/**
 * ✨ CORRIGIDO: mergePos SEMPRE cria um novo objeto
 * 
 * Antes (❌ BUG):
 * if (!newPos) return oldPos;  // ← Compartilha referência!
 * 
 * Agora (✅ CORRETO):
 * Cria SEMPRE um novo objeto com cópia de valores
 */
function mergePos(oldPos, newPos) {
  return {
    x: newPos?.x != null ? Number(newPos.x) : (oldPos?.x ?? 0),
    y: newPos?.y != null ? Number(newPos.y) : (oldPos?.y ?? undefined),
    z: newPos?.z != null ? Number(newPos.z) : (oldPos?.z ?? 0),
  };
}

function mergeVitals(baseVitals, rawDelta, nextHpCompat) {
  const current = baseVitals ?? {
    hp: { current: 0, max: 0 },
    stamina: { current: 0, max: 0 },
  };

  const deltaVitals = rawDelta?.vitals ?? null;
  const stats = rawDelta?.stats ?? null;

  const hpCurrent =
    deltaVitals?.hp?.current ??
    rawDelta?.hp ??
    rawDelta?.hpCurrent ??
    rawDelta?.hp_current ??
    stats?.hpCurrent ??
    stats?.hp_current ??
    nextHpCompat ??
    current.hp.current;

  const hpMax =
    deltaVitals?.hp?.max ??
    rawDelta?.hpMax ??
    rawDelta?.hp_max ??
    stats?.hpMax ??
    stats?.hp_max ??
    current.hp.max;

  const staminaCurrent =
    deltaVitals?.stamina?.current ??
    rawDelta?.staminaCurrent ??
    rawDelta?.stamina_current ??
    stats?.staminaCurrent ??
    stats?.stamina_current ??
    current.stamina.current;

  const staminaMax =
    deltaVitals?.stamina?.max ??
    rawDelta?.staminaMax ??
    rawDelta?.stamina_max ??
    stats?.staminaMax ??
    stats?.stamina_max ??
    current.stamina.max;

  return {
    hp: {
      current: toNum(hpCurrent, 0),
      max: toNum(hpMax, 0),
    },
    stamina: {
      current: toNum(staminaCurrent, 0),
      max: toNum(staminaMax, 0),
    },
  };
}

export function createEntitiesStore() {
  const state = {
    entities: new Map(), // entityId(string) -> Entity
    selfId: null, // string
    instanceId: null,
    chunk: null, // {cx,cz}
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

  function applyBaseline(payload) {
    // Baseline sempre vence: troca completa do estado replicado.
    console.log("[ENTITIES_STORE] 📦 applyBaseline chamado");
    console.log("[ENTITIES_STORE] payload.ok:", payload?.ok);
    console.log("[ENTITIES_STORE] payload.you:", payload?.you);
    console.log("[ENTITIES_STORE] payload.others:", payload?.others);
    console.log("[ENTITIES_STORE] payload.entities:", payload?.entities);
    
    if (!payload || payload.ok !== true) {
      console.log("[ENTITIES_STORE] ❌ REJEITADO: !payload ou payload.ok !== true");
      return;
    }

    state.entities.clear();

    state.instanceId = payload.instanceId ?? null;
    state.chunk = payload.chunk ?? null;
    state.t = Number(payload.t ?? 0);

    // FIX: normaliza selfId ANTES de inserir others, para evitar "self como other"
    const you = payload.you ?? null;
    console.log("[ENTITIES_STORE] you (depois de null coalesce):", you);
    
    let nextSelfId = null;
    let youEntity = null;

    if (typeof you === "string" || typeof you === "number") {
      nextSelfId = toId(you);
      console.log("[ENTITIES_STORE] ✅ you é primitivo (string/number), nextSelfId:", nextSelfId);
      debugIds("baseline: selfId set (primitive)", nextSelfId);
    } else if (you && typeof you === "object") {
      console.log("[ENTITIES_STORE] you é objeto, normalizando...");
      youEntity = normalizeEntity(you);
      console.log("[ENTITIES_STORE] youEntity após normalize:", youEntity);
      if (youEntity) {
        nextSelfId = youEntity.entityId;
        console.log("[ENTITIES_STORE] ✅ youEntity normalizado, nextSelfId:", nextSelfId);
        debugIds("baseline: selfId set (entity)", nextSelfId);
      } else {
        console.log("[ENTITIES_STORE] ❌ youEntity é null após normalize!");
      }
    } else {
      console.log("[ENTITIES_STORE] ⚠️ you não é primitivo nem objeto:", typeof you);
    }

    // compat: baseline pode vir como { others } (novo) ou { entities } (legado)
    const list = Array.isArray(payload.others)
      ? payload.others
      : Array.isArray(payload.entities)
        ? payload.entities
        : [];

    console.log("[ENTITIES_STORE] others/entities list count:", list.length);

    for (const raw of list) {
      const e = normalizeEntity(raw);
      if (!e) continue;

      // evita inserir self como "other" se vier indevidamente no baseline
      if (nextSelfId && e.entityId === nextSelfId) {
        console.log("[ENTITIES_STORE] 🚫 Pulando self na lista:", e.entityId);
        debugIds("baseline: skip self in others", e.entityId);
        continue;
      }

      console.log("[ENTITIES_STORE] ➕ Adicionando entidade:", e.entityId, e);
      state.entities.set(e.entityId, e);
    }

    // se baseline não enviar "you", mantém selfId anterior para evitar null/ownership swap
    if (nextSelfId == null) {
      console.log("[ENTITIES_STORE] ⚠️ nextSelfId é NULL! selfId anterior:", state.selfId);
      debugIds("baseline: missing you, keep selfId", state.selfId);
    } else {
      console.log("[ENTITIES_STORE] ✅ Setando state.selfId para:", nextSelfId);
      state.selfId = nextSelfId;
    }

    // garante presença do self mesmo se baseline não listar self em "others"
    if (youEntity) {
      console.log("[ENTITIES_STORE] 📍 Garantindo presença do self no mapa");
      const current = state.entities.get(youEntity.entityId);
      if (!current || youEntity.rev >= (current.rev ?? 0)) {
        console.log("[ENTITIES_STORE] ✅ Inserindo self no mapa:", youEntity.entityId);
        state.entities.set(youEntity.entityId, youEntity);
      }
    }

    console.log("[ENTITIES_STORE] ✅ applyBaseline COMPLETO. state.selfId:", state.selfId);
    console.log("[ENTITIES_STORE] Entidades no mapa:", Array.from(state.entities.keys()));
    emitChange();
  }

  function applySpawn(entityRaw) {
    const e = normalizeEntity(entityRaw);
    if (!e) return;

    console.log("[ENTITIES_STORE] 🎯 applySpawn entityId:", e.entityId, "selfId:", state.selfId);

    // evita tratar self como "other" em spawn
    if (state.selfId && e.entityId === state.selfId) {
      console.log("[ENTITIES_STORE] 🚫 applySpawn PULANDO SELF:", e.entityId);
      debugIds("spawn: skip self", e.entityId);
      return;
    }

    const cur = state.entities.get(e.entityId);
    const curRev = cur?.rev ?? -1;

    // só aplica se rev for maior (ou se não existir)
    if (!cur || e.rev > curRev) {
      console.log("[ENTITIES_STORE] ✅ applySpawn ADICIONANDO:", e.entityId);
      state.entities.set(e.entityId, e);
      emitChange();
    } else {
      console.log("[ENTITIES_STORE] ⏭️ applySpawn IGNORANDO (rev old):", e.entityId, "cur.rev:", curRev, "e.rev:", e.rev);
    }
  }

  function applyDespawn(entityIdRaw) {
    const entityId = toId(entityIdRaw);
    if (!entityId) return;

    // evita despawn do self por acidente
    if (state.selfId && entityId === state.selfId) {
      console.log("[ENTITIES_STORE] 🚫 applyDespawn PULANDO SELF:", entityId);
      debugIds("despawn: skip self", entityId);
      return;
    }

    console.log("[ENTITIES_STORE] ✅ applyDespawn REMOVENDO:", entityId);
    state.entities.delete(entityId);
    emitChange();
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

    // regra obrigatória: só aplica se rev maior
    if (nextRev <= curRev) return;

    // Se não existe ainda, cria com defaults e aplica delta
    const base =
      cur ??
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
        },
        action: "idle",
        rev: -1,
      });

    const nextHpCompat = delta.hp != null ? Number(delta.hp) : base.hp;
    const nextVitals = mergeVitals(base.vitals, delta, nextHpCompat);

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
      action: delta.action != null ? delta.action : base.action,
    };

    state.entities.set(entityId, next);
    emitChange();
  }

  function getSnapshot() {
    // Render-friendly: array estável (sem expor o Map)
    return Array.from(state.entities.values());
  }

  return {
    // estado (somente leitura via referência)
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

    // mutações
    clear,
    applyBaseline,
    applySpawn,
    applyDespawn,
    applyDelta,
    subscribe,

    // leitura
    getSnapshot,
  };
}
