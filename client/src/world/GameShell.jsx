/**
 * =====================================================================
 * ⚠️ REGRA DE OURO — COMENTÁRIO IMUTÁVEL (NÃO REMOVER)
 * =====================================================================
 *
 * ❌ ESTE BLOCO DE COMENTÁRIO NÃO PODE SER REMOVIDO
 * ❌ ESTE BLOCO NÃO PODE SER ENCURTADO
 *
 * 📦 Arquivo: GameShell.jsx
 *
 * Papel:
 * - Orquestrar o ciclo de vida do runtime no cliente.
 * - Executar o bootstrap do mundo (snapshot inicial) após autenticação.
 * - Subir a conexão Socket.IO (após snapshot existir) para receber estado confirmado.
 * - Atualizar o snapshot.runtime SOMENTE com dados confirmados pelo servidor (move:state).
 * - Entregar o snapshot (e o socket) para o render host (GameCanvas).
 *
 * Fonte da verdade:
 * - Backend (snapshot inicial via /world/bootstrap e updates via socket events).
 * - O cliente NÃO calcula posição final e NÃO simula mundo.
 *
 * NÃO FAZ:
 * - NÃO renderiza Three.js nem cria scene/camera/renderer.
 * - NÃO move player localmente.
 * - NÃO calcula física, colisão ou posição preditiva.
 * - NÃO implementa multiplayer (rooms/broadcast).
 * - NÃO persiste runtime no banco (isso é responsabilidade do servidor).
 *
 * FAZ:
 * - Faz bootstrapWorld(token) e valida erros (inclui 401).
 * - Conecta socket com token (handshake auth) somente após snapshot inicial.
 * - Escuta "move:state" e aplica patch no snapshot.runtime (imutável via setState).
 * - Faz cleanup de listeners e desconecta socket no unmount.
 *
 * 🤖 IAs:
 * - Ao editar este arquivo, preservar o contrato: Backend autoritativo.
 * - Não introduzir simulação local, nem duplicar fontes de verdade.
 * - Mudanças devem ser incrementais e compatíveis com o snapshot existente.
 *
 * =====================================================================
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { GameCanvas } from "./scene/GameCanvas";
import { bootstrapWorld } from "@/services/World";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay";
import { connectSocket, disconnectSocket } from "@/services/Socket";
import { createEntitiesStore } from "./state/entitiesStore";
import { logInventory } from "@/inventory/inventoryProbe";
import { IntentType } from "./input/intents";
import { InventoryModal } from "@/components/models/inventory/InventoryModal";

const DEBUG_IDS = false;

const toId = (raw) => (raw == null ? null : String(raw));

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDisplayInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function debugIds(...args) {
  if (!DEBUG_IDS) return;
  // console.log(...args);
}

function isInteractDown(type) {
  return (
    type === IntentType.INTERACT_PRIMARY_DOWN ||
    type === IntentType.INTERACT_PRESS
  );
}

function isInteractUp(type) {
  return (
    type === IntentType.INTERACT_PRIMARY_UP ||
    type === IntentType.INTERACT_RELEASE
  );
}

function normalizeVitals(raw) {
  const hpCurrent =
    raw?.vitals?.hp?.current ??
    raw?.hpCurrent ??
    raw?.hp_current ??
    raw?.hp ??
    0;

  const hpMax =
    raw?.vitals?.hp?.max ??
    raw?.hpMax ??
    raw?.hp_max ??
    0;

  const staminaCurrent =
    raw?.vitals?.stamina?.current ??
    raw?.staminaCurrent ??
    raw?.stamina_current ??
    0;

  const staminaMax =
    raw?.vitals?.stamina?.max ??
    raw?.staminaMax ??
    raw?.stamina_max ??
    0;

  return {
    hp: {
      current: toDisplayInt(hpCurrent, 0),
      max: toDisplayInt(hpMax, 0),
    },
    stamina: {
      current: toDisplayInt(staminaCurrent, 0),
      max: toDisplayInt(staminaMax, 0),
    },
  };
}

function pickBestSelfVitals(snapshot, selfEntity) {
  if (snapshot?.runtime?.vitals) {
    return normalizeVitals(snapshot.runtime);
  }

  if (selfEntity?.vitals) {
    return normalizeVitals(selfEntity);
  }

  if (snapshot?.ui?.self?.vitals) {
    return normalizeVitals(snapshot.ui.self);
  }

  return {
    hp: { current: 0, max: 0 },
    stamina: { current: 0, max: 0 },
  };
}

export function GameShell() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [sessionReplaced, setSessionReplaced] = useState(null);

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventorySnapshot, setInventorySnapshot] = useState(null);

  const socketRef = useRef(null);
  const joinedRef = useRef(false);
  const pendingInvRequestRef = useRef(false);

  // { kind: "ACTOR"|"PLAYER"|"ENEMY", id: "123" } | null
  const selectedTargetRef = useRef(null);

  // ✨ NOVO: Rastrear estado de combate com inimigo
  // Detecta qual inimigo já teve interact:start enviado
  const combatTargetRef = useRef(null);

  const worldStoreRef = useRef(null);
  if (!worldStoreRef.current) {
    worldStoreRef.current = createEntitiesStore();
  }

  const requestInventoryFull = useCallback(() => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    s.emit("inv:request_full", { reason: "ui_open" });
    return true;
  }, []);

  const emitInteractStart = useCallback(() => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    const t = selectedTargetRef.current;

    if (t?.kind && t?.id) {
      s.emit("interact:start", {
        target: {
          kind: String(t.kind),
          id: String(t.id),
        },
      });
    } else {
      s.emit("interact:start", {});
    }

    return true;
  }, []);

  const emitInteractStop = useCallback(() => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    s.emit("interact:stop", {});
    return true;
  }, []);

  const closeInventory = useCallback(() => {
    if (combatTargetRef.current != null) {
      emitInteractStop();
    }

    selectedTargetRef.current = null;
    combatTargetRef.current = null;
    setInventoryOpen(false);
  }, [emitInteractStop]);

  const onTargetSelect = useCallback((target) => {
    if (!target?.kind || target?.id == null) return;

    selectedTargetRef.current = {
      kind: String(target.kind),
      id: String(target.id),
    };

    // ✨ NOVO: Reset combate quando muda de alvo
    combatTargetRef.current = null;
  }, []);

  const onTargetClear = useCallback(() => {
    if (combatTargetRef.current != null) {
      emitInteractStop();
    }

    selectedTargetRef.current = null;
    // ✨ NOVO: Limpar combate também
    combatTargetRef.current = null;
  }, [emitInteractStop]);

  const handleInputIntent = useCallback(
    (intent) => {
      if (!intent || typeof intent !== "object") return;

      if (intent.type === IntentType.UI_TOGGLE_INVENTORY) {
        setInventoryOpen((prev) => {
          const next = !prev;

          if (next) {
            pendingInvRequestRef.current = true;
            const ok = requestInventoryFull();
            if (ok) pendingInvRequestRef.current = false;
          }

          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_CANCEL) {
        closeInventory();
        return;
      }

      if (intent.type === IntentType.TARGET_SELECT) {
        const kind = intent?.target?.kind;
        const id = intent?.target?.id;

        if (kind && id != null) {
          selectedTargetRef.current = {
            kind: String(kind),
            id: String(id),
          };
          // ✨ NOVO: Reset combate quando seleciona novo alvo
          combatTargetRef.current = null;
        }
        return;
      }

      if (intent.type === IntentType.TARGET_CLEAR) {
        selectedTargetRef.current = null;
        combatTargetRef.current = null;
        return;
      }

      // Combate em um único comando: inicia a perseguição/auto-ataque no servidor.
      if (isInteractDown(intent.type)) {
        const target = selectedTargetRef.current;

        console.log("[INPUT] Interact press | Target:", target);

        if (target?.kind === "ENEMY") {
          const targetId = String(target.id);

          if (combatTargetRef.current !== targetId) {
            console.log("[COMBAT] STAGE 1: Iniciando movimento para inimigo", targetId);
            socketRef.current?.emit("interact:start", {
              target: {
                kind: String(target.kind),
                id: targetId,
              },
            });
            combatTargetRef.current = targetId;
            return;
          }

          console.log("[COMBAT] Combat already armed for enemy", targetId);
          return;
        }

        // Para ACTOR e outros: comportamento normal
        emitInteractStart();
        return;
      }

      if (isInteractUp(intent.type)) {
        const target = selectedTargetRef.current;

        // Soltar SPACE não cancela combate de ENEMY.
        // O cancelamento explícito fica para seleção/ação de movimento.
        if (target?.kind && target.kind !== "ENEMY") {
          emitInteractStop();
        }
        return;
      }
    },
    [requestInventoryFull, emitInteractStart, emitInteractStop]
  );

  useEffect(() => {
    let mounted = true;
    let localSocket = null;

    let onInvFull = null;
    let onSocketReady = null;
    let onWorldBaseline = null;
    let onEntitySpawn = null;
    let onEntityDespawn = null;
    let onEntityDelta = null;
    let onMoveState = null;
    let onSessionReplaced = null;
    let onConnectError = null;
    let onEnemyAttack = null;

    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return () => {};
    }

    const boot = async () => {
      try {
        const data = await bootstrapWorld(token);

        if (!mounted) return;

        logInventory("BOOTSTRAP_HTTP", data?.inventory);
        if (data?.inventory?.ok === true) {
          setInventorySnapshot(data.inventory);
        }

        if (!data || data?.error) {
          if (data?.status === 401) {
            localStorage.removeItem("token");
            window.location.reload();
            return;
          }
          return;
        }

        setSnapshot(data.snapshot);

        const socket = connectSocket(token);
        localSocket = socket;
        socketRef.current = socket;

        joinedRef.current = false;
        pendingInvRequestRef.current = false;

        const store = worldStoreRef.current;

        onInvFull = (payload) => {
          const inv = payload?.ok === true ? payload : payload ?? { ok: false };
          logInventory("SOCKET_INV_FULL", inv);

          if (inv?.ok === true) {
            setInventorySnapshot(inv);
          }
        };

        onSocketReady = (payload) => {
          if (payload?.ok !== true) return;

          socket.emit("world:join", {}, (ack) => {
            if (!mounted) return;
            if (ack?.ok === false) return;

            joinedRef.current = true;

            if (pendingInvRequestRef.current) {
              const ok = requestInventoryFull();
              if (ok) pendingInvRequestRef.current = false;
            }
          });
        };

        onWorldBaseline = (payload) => {
          store.applyBaseline(payload);

          const selfId = toId(store.selfId);
          debugIds("baseline: selfId", selfId);
          if (!selfId) return;

          const self = store.entities.get(String(selfId));
          if (!self) return;

          setSnapshot((prev) => {
            if (!prev || !prev.runtime) return prev;

            const nextVitals = normalizeVitals(self);
            return {
              ...prev,
              runtime: {
                ...prev.runtime,
                yaw: self.yaw ?? prev.runtime.yaw,
                pos: {
                  x: self.pos?.x ?? prev.runtime.pos?.x ?? 0,
                  y: self.pos?.y ?? prev.runtime.pos?.y ?? 0,
                  z: self.pos?.z ?? prev.runtime.pos?.z ?? 0,
                },
                vitals: nextVitals,
              },
              ui: {
                ...(prev.ui ?? {}),
                self: {
                  ...((prev.ui && prev.ui.self) ?? {}),
                  ...nextVitals,
                  vitals: nextVitals,
                },
              },
            };
          });
        };

        onEntitySpawn = (payload) => {
          let entity = payload?.entity ?? payload;
          const entityId = toId(
            entity?.entityId ?? entity?.id ?? entity?.entity_id ?? null
          );

          if (entityId && String(entityId) === String(store.selfId)) {
            debugIds("spawn: skip self", entityId);
            return;
          }

          if (entity && typeof entity === "object" && entityId) {
            entity = { ...entity, entityId };
          }

          store.applySpawn(entity);
        };

        onEntityDespawn = (payload) => {
          const entityId = toId(payload?.entityId ?? payload?.id ?? payload);

          if (entityId && String(entityId) === String(store.selfId)) {
            debugIds("despawn: skip self", entityId);
            return;
          }

          store.applyDespawn(entityId);
        };

        onEntityDelta = (payload) => {
          store.applyDelta(payload);

          const selfId = toId(store.selfId);
          if (!selfId) return;

          const entityId = toId(
            payload?.entityId ?? payload?.id ?? payload?.entity_id ?? null
          );
          if (!entityId) return;
          if (String(entityId) !== String(selfId)) return;

          const self = store.entities.get(String(selfId));
          if (!self) return;

          setSnapshot((prev) => {
            if (!prev || !prev.runtime) return prev;

            const nextVitals = normalizeVitals(self);

            return {
              ...prev,
              runtime: {
                ...prev.runtime,
                yaw: self.yaw ?? prev.runtime.yaw,
                pos: {
                  x: self.pos?.x ?? prev.runtime.pos?.x ?? 0,
                  y: self.pos?.y ?? prev.runtime.pos?.y ?? 0,
                  z: self.pos?.z ?? prev.runtime.pos?.z ?? 0,
                },
                vitals: nextVitals,
              },
              ui: {
                ...(prev.ui ?? {}),
                self: {
                  ...((prev.ui && prev.ui.self) ?? {}),
                  ...nextVitals,
                  vitals: nextVitals,
                },
              },
            };
          });
        };

        onMoveState = (payload) => {
          setSnapshot((prev) => {
            if (!prev || !prev.runtime) return prev;

            const x = payload?.pos?.x;
            const y = payload?.pos?.y;
            const z = payload?.pos?.z;

            return {
              ...prev,
              runtime: {
                ...prev.runtime,
                yaw: payload?.yaw ?? prev.runtime.yaw,
                pos: {
                  x: x ?? prev.runtime.pos?.x ?? 0,
                  y: y ?? prev.runtime.pos?.y ?? 0,
                  z: z ?? prev.runtime.pos?.z ?? 0,
                },
                vitals: payload?.vitals
                  ? normalizeVitals({ vitals: payload.vitals })
                  : prev.runtime.vitals,
              },
            };
          });

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
            action: payload?.action,
          });

          const self = store.entities.get(String(selfId));
          if (!self) return;

          setSnapshot((prev) => {
            if (!prev || !prev.runtime) return prev;

            const preservedVitals = prev?.ui?.self?.vitals
              ? normalizeVitals(prev.ui.self)
              : null;
            const nextVitals = preservedVitals ?? normalizeVitals(self);

            return {
              ...prev,
              runtime: {
                ...prev.runtime,
                vitals: nextVitals,
              },
              ui: {
                ...(prev.ui ?? {}),
                self: {
                  ...((prev.ui && prev.ui.self) ?? {}),
                  vitals: nextVitals,
                },
              },
            };
          });
        };

        onSessionReplaced = (payload) => {
          setSessionReplaced(payload ?? { reason: "session_replaced" });

          try {
            const s = socketRef.current;
            if (s) s.removeAllListeners();
          } catch {}

          disconnectSocket();
          socketRef.current = null;
          localSocket = null;

          store.clear();
        };

        onConnectError = (err) => {
          console.error("[SOCKET] connect_error:", err?.message || err);
        };

        // ✨ NOVO: Escutar ataques do inimigo
        onEnemyAttack = (payload) => {
          console.log("[COMBAT] Enemy attack received:", payload);
          setSnapshot((prev) => {
            if (!prev?.runtime) return prev;

            const currentVitals = prev.runtime.vitals ?? normalizeVitals(prev.runtime);
            const hpCurrentRaw = payload?.targetHPAfter ?? payload?.hpAfter ?? payload?.damageAfter;
            const hpMaxRaw = payload?.targetHPMax ?? payload?.hpMax;
            const hpCurrent = Number.isFinite(Number(hpCurrentRaw))
              ? Math.max(0, Number(hpCurrentRaw))
              : currentVitals?.hp?.current ?? 0;
            const hpMax = Number.isFinite(Number(hpMaxRaw))
              ? Math.max(0, Number(hpMaxRaw))
              : currentVitals?.hp?.max ?? 0;

            const selfVitals = {
              hp: {
                current: hpCurrent,
                max: hpMax,
              },
              stamina: currentVitals?.stamina ?? { current: 0, max: 0 },
            };

            return {
              ...prev,
              runtime: {
                ...prev.runtime,
                vitals: selfVitals,
              },
              ui: {
                ...(prev.ui ?? {}),
                self: {
                  ...((prev.ui && prev.ui.self) ?? {}),
                  vitals: selfVitals,
                },
              },
            };
          });
        };

        socket.on("socket:ready", onSocketReady);

        socket.on("world:baseline", onWorldBaseline);
        socket.on("entity:spawn", onEntitySpawn);
        socket.on("entity:despawn", onEntityDespawn);
        socket.on("entity:delta", onEntityDelta);

        socket.on("move:state", onMoveState);
        socket.on("session:replaced", onSessionReplaced);
        socket.on("connect_error", onConnectError);

        socket.on("inv:full", onInvFull);
        socket.on("combat:enemy_attack", onEnemyAttack);
      } catch (err) {
        if (!mounted) return;
        console.error("[GAMESHELL] exception:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    boot();

    return () => {
      mounted = false;

      const s = localSocket || socketRef.current;
      if (s) {
        if (onSocketReady) s.off("socket:ready", onSocketReady);

        if (onWorldBaseline) s.off("world:baseline", onWorldBaseline);
        if (onEntitySpawn) s.off("entity:spawn", onEntitySpawn);
        if (onEntityDespawn) s.off("entity:despawn", onEntityDespawn);
        if (onEntityDelta) s.off("entity:delta", onEntityDelta);

        if (onMoveState) s.off("move:state", onMoveState);
        if (onSessionReplaced) s.off("session:replaced", onSessionReplaced);
        if (onConnectError) s.off("connect_error", onConnectError);

        if (onInvFull) s.off("inv:full", onInvFull);
        if (onEnemyAttack) s.off("combat:enemy_attack", onEnemyAttack);
      }

      disconnectSocket();
      socketRef.current = null;

      joinedRef.current = false;
      pendingInvRequestRef.current = false;
      selectedTargetRef.current = null;
      combatTargetRef.current = null;
    };
  }, [requestInventoryFull]);

  if (sessionReplaced) {
    return (
      <LoadingOverlay message="Sessão substituída: você entrou em outro lugar. Recarregue para continuar." />
    );
  }

  if (loading) return <LoadingOverlay message="Carregando mundo..." />;
  if (!snapshot) return <LoadingOverlay message="Falha ao carregar mundo" />;

  return (
    <>
      <GameCanvas
        snapshot={snapshot}
        worldStoreRef={worldStoreRef}
        onInputIntent={handleInputIntent}
        onTargetSelect={onTargetSelect}
        onTargetClear={onTargetClear}
      />

      <InventoryModal
        open={inventoryOpen}
        snapshot={inventorySnapshot}
        onClose={closeInventory}
      />
    </>
  );
}
