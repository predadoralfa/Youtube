// server/socket/handlers/interactHandler.js

const {
    ensureRuntimeLoaded,
    getRuntime,
    isWASDActive,
  } = require("../../state/runtimeStore");
  
  const { getActor } = require("../../state/actorsRuntimeStore");
  
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
   * - ACTOR: via actorsRuntimeStore (cache em memória)
   */
  function resolveTargetPos({ requesterRt, target }) {
    if (!target?.kind || target?.id == null) return null;
  
    if (target.kind === "PLAYER") {
      const other = getRuntime(String(target.id));
      if (!other) return null;
  
      // blindagem: não interage cross-instance
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
  
    return null;
  }
  
  function applyApproach({ rt, nowMs, targetPos, stopRadius }) {
    // bounds obrigatório (mesma regra do click-to-move)
    const b = rt.bounds;
    if (!b) return false;
  
    const minX = Number(b.minX);
    const maxX = Number(b.maxX);
    const minZ = Number(b.minZ);
    const maxZ = Number(b.maxZ);
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return false;
  
    const tx = clamp(Number(targetPos.x), minX, maxX);
    const tz = clamp(Number(targetPos.z), minZ, maxZ);
  
    // Reutiliza motor CLICK
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
   * - stop: ✅ MUDANÇA: NÃO cancela o movimento. Apenas limpa rt.interact.
   *
   * Resultado: SPACE vira "um comando" (tipo click):
   * - apertou: começa a ir
   * - soltou: continua indo até chegar (ou até outro comando sobrescrever)
   */
  function registerInteractHandler(io, socket) {
    socket.on("interact:start", async (payload = {}) => {
      try {
        // gate: não aceita nada antes do join autoritativo
        if (socket.data?._worldJoined !== true) return;
  
        const userId = socket.data.userId;
        const nowMs = Date.now();
  
        await ensureRuntimeLoaded(userId);
        const rt = getRuntime(userId);
        if (!rt) return;
  
        // blindagem: se caiu / está pendente / offline, ignora
        if (
          rt.connectionState === "DISCONNECTED_PENDING" ||
          rt.connectionState === "OFFLINE"
        ) {
          return;
        }
  
        // se WASD ativo, não “rouba” controle
        if (isWASDActive(rt, nowMs)) return;
  
        const target = payload?.target;
        if (!target?.kind || target?.id == null) return;
  
        // não interagir com self
        if (target.kind === "PLAYER" && String(target.id) === String(userId)) return;
  
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
  
        const targetPos = resolveTargetPos({ requesterRt: rt, target });
        if (!targetPos) return;
  
        // estado de interação (autoridade server-side)
        rt.interact = {
          active: true,
          kind: String(target.kind),
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
  
        // ✅ MUDANÇA: não cancela moveTarget/moveMode.
        // Apenas encerra o "modo interact" (usado depois para follow/minerar/atacar).
        rt.interact = null;
      } catch (e) {
        console.error("[INTERACT] stop error:", e);
      }
    });
  }
  
  module.exports = { registerInteractHandler };