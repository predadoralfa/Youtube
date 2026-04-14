export function toId(raw) {
  if (raw == null) return null;
  return String(raw);
}

export function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toDisplayInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export function normalizeVitals(raw) {
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

  const hungerCurrent =
    vitals?.hunger?.current ??
    raw?.hungerCurrent ??
    raw?.hunger_current ??
    stats?.hungerCurrent ??
    stats?.hunger_current;

  const hungerMax =
    vitals?.hunger?.max ??
    raw?.hungerMax ??
    raw?.hunger_max ??
    stats?.hungerMax ??
    stats?.hunger_max;

  return {
    hp: {
      current: toDisplayInt(hpCurrent, 0),
      max: toDisplayInt(hpMax, 0),
    },
    stamina: {
      current: toDisplayInt(staminaCurrent, 0),
      max: toDisplayInt(staminaMax, 0),
    },
    hunger: {
      current: toDisplayInt(hungerCurrent, 0),
      max: toDisplayInt(hungerMax, 0),
    },
  };
}

export function normalizeEntity(raw) {
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

  return {
    entityId,
    kind: raw.kind ?? null,
    displayName: raw.displayName ?? raw.display_name ?? null,
    enemyDefCode: raw.enemyDefCode ?? raw.enemy_def_code ?? null,
    enemyDefName: raw.enemyDefName ?? raw.enemy_def_name ?? null,
    visualKind: raw.visualKind ?? raw.visual_kind ?? null,
    assetKey: raw.assetKey ?? raw.asset_key ?? null,
    visualScale: raw.visualScale ?? raw.visual_scale ?? null,
    pos,
    yaw: Number(raw.yaw ?? 0),
    hp: toNum(raw.hp ?? vitals.hp.current, 0),
    vitals,
    action: raw.action ?? "idle",
    rev: Number(raw.rev ?? 0),
  };
}
