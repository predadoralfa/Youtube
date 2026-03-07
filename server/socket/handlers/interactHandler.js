// server/socket/handlers/interactHandler.js

const db = require("../../models");

const {
  ensureRuntimeLoaded,
  getRuntime,
  isWASDActive,
} = require("../../state/runtimeStore");

const { getActor } = require("../../state/actorsRuntimeStore");
const { getEnemy } = require("../../state/enemies/enemiesRuntimeStore");

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const DEFAULT_STOP_RADIUS = 1.25;
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Resolve a posição autoritativa do alvo.
 * - PLAYER: via runtimeStore
 * - ACTOR: via actorsRuntimeStore
 * - ENEMY: via enemiesRuntimeStore
 *
 * Regras:
 * - nunca cross-instance
 * - nunca usa posição vinda do client
 * - apenas backend decide o ponto real do alvo
 */
function resolveTargetPos({ requesterRt, target }) {
  if (!target?.kind || target?.id == null) return null;

  if (target.kind === "PLAYER") {
    const other = getRuntime(String(target.id));
    if (!other) return null;

    if (String(other.instanceId) !== String(requesterRt.instanceId)) return null;

    const p = other.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) return null;

    return { x: p.x, z: p.z };
  }

  if (target.kind === "ACTOR") {
    const actor = getActor(String(target.id));
    if (!actor) return null;

    if (String(actor.instanceId) !== String(requesterRt.instanceId)) return null;

    const p = actor.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) return null;

    return { x: p.x, z: p.z };
  }

  if (target.kind === "ENEMY") {
    const enemy = getEnemy(String(target.id));
    if (!enemy) return null;

    if (String(enemy.instanceId) !== String(requesterRt.instanceId)) return null;
    if (String(enemy.status) !== "ALIVE") return null;

    const p = enemy.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) return null;

    return { x: p.x, z: p.z };
  }

  return null;
}

function applyApproach({ rt, nowMs, targetPos, stopRadius }) {
  const b = rt.bounds;
  if (!b) return false;

  const minX = Number(b.minX);
  const maxX = Number(b.maxX);
  const minZ = Number(b.minZ);
  const maxZ = Number(b.maxZ);

  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return false;

  const tx = clamp(Number(targetPos.x), minX, maxX);
  const tz = clamp(Number(targetPos.z), minZ, maxZ);

  rt.moveMode = "CLICK";
  rt.moveTarget = { x: tx, z: tz };
  rt.moveStopRadius = stopRadius;
  rt.moveTickAtMs = nowMs;
  rt.action = "move";

  return true;
}

/**
 * SPACE press/release:
 * - start: grava rt.interact + injeta moveTarget (motor CLICK)
 * - stop: não cancela o movimento. Apenas limpa rt.interact.
 *
 * Resultado:
 * - apertou: começa a ir até o target
 * - soltou: continua indo até chegar, a menos que outro comando sobrescreva
 *
 * Futuro:
 * - ACTOR  => coleta / interação
 * - ENEMY  => ataque / follow hostil
 * - PLAYER => interação social / follow / trade / etc
 */
function registerInteractHandler(io, socket) {
  socket.on("interact:start", async (payload = {}) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      const nowMs = Date.now();

      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const stats = await db.GaUserStats.findByPk(userId, {
        attributes: ["collect_cooldown_ms"],
      });
      rt.collectCooldownMs = stats?.collect_cooldown_ms ?? 1000;

      if (
        rt.connectionState === "DISCONNECTED_PENDING" ||
        rt.connectionState === "OFFLINE"
      ) {
        return;
      }

      if (isWASDActive(rt, nowMs)) return;

      const target = payload?.target;
      if (!target?.kind || target?.id == null) return;

      const targetKind = String(target.kind);

      if (targetKind === "PLAYER" && String(target.id) === String(userId)) return;

      if (
        targetKind !== "PLAYER" &&
        targetKind !== "ACTOR" &&
        targetKind !== "ENEMY"
      ) {
        return;
      }

      const stopRadiusRaw = payload?.stopRadius;
      const stopRadius =
        isFiniteNumber(stopRadiusRaw) && stopRadiusRaw > 0
          ? stopRadiusRaw
          : DEFAULT_STOP_RADIUS;

      const timeoutMsRaw = payload?.timeoutMs;
      const timeoutMs =
        isFiniteNumber(timeoutMsRaw) && timeoutMsRaw > 0
          ? timeoutMsRaw
          : DEFAULT_TIMEOUT_MS;

      const targetPos = resolveTargetPos({
        requesterRt: rt,
        target: { kind: targetKind, id: String(target.id) },
      });

      if (!targetPos) return;

      rt.interact = {
        active: true,
        kind: targetKind,
        id: String(target.id),
        stopRadius,
        startedAtMs: nowMs,
        timeoutMs,
      };

      applyApproach({ rt, nowMs, targetPos, stopRadius });
    } catch (e) {
      console.error("[INTERACT] start error:", e);
    }
  });

  socket.on("interact:stop", async () => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;

      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const cur = rt.interact;
      if (!cur?.active) return;

      rt.interact = null;
    } catch (e) {
      console.error("[INTERACT] stop error:", e);
    }
  });
}

module.exports = { registerInteractHandler };