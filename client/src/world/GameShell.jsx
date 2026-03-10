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
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { GameCanvas } from "./scene/GameCanvas";
import { bootstrapWorld } from "@/services/World";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay";
import { connectSocket, disconnectSocket } from "@/services/Socket";
import { createEntitiesStore } from "./state/entitiesStore";
import { logInventory } from "@/inventory/inventoryProbe";
import { IntentType } from "./input/intents";
import { InventoryModal } from "@/components/models/inventory/InventoryModal";
import { HPBar } from "./scene/HPBar";

const DEBUG_IDS = false;

const toId = (raw) => (raw == null ? null : String(raw));

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
      current: toNum(hpCurrent, 0),
      max: toNum(hpMax, 0),
    },
    stamina: {
      current: toNum(staminaCurrent, 0),
      max: toNum(staminaMax, 0),
    },
  };
}

function pickBestSelfVitals(snapshot, selfEntity) {
  if (selfEntity?.vitals) {
    return normalizeVitals(selfEntity);
  }

  if (snapshot?.ui?.self?.vitals) {
    return normalizeVitals(snapshot.ui.self);
  }

  if (snapshot?.runtime?.vitals) {
    return normalizeVitals(snapshot.runtime);
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
    setInventoryOpen(false);
  }, []);

  const onTargetSelect = useCallback((target) => {
    if (!target?.kind || target?.id == null) return;

    selectedTargetRef.current = {
      kind: String(target.kind),
      id: String(target.id),
    };
  }, []);

  const onTargetClear = useCallback(() => {
    selectedTargetRef.current = null;
  }, []);

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

      if (intent.type === IntentType.TARGET_SELECT) {
        const kind = intent?.target?.kind;
        const id = intent?.target?.id;

        if (kind && id != null) {
          selectedTargetRef.current = {
            kind: String(kind),
            id: String(id),
          };
        }
        return;
      }

      if (intent.type === IntentType.TARGET_CLEAR) {
        selectedTargetRef.current = null;
        return;
      }

      if (isInteractDown(intent.type)) {
        emitInteractStart();
        return;
      }

      if (isInteractUp(intent.type)) {
        emitInteractStop();
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
          } else {
            console.warn("[INV] inv:full not ok (ignored)", inv?.error);
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

          const selfVitals = normalizeVitals(self);

          setSnapshot((prev) => {
            if (!prev || !prev.runtime) return prev;

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

          const selfVitals = normalizeVitals(self);

          setSnapshot((prev) => {
            if (!prev || !prev.runtime) return prev;

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

          const selfVitals = normalizeVitals(self);

          setSnapshot((prev) => {
            if (!prev || !prev.runtime) return prev;

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

        socket.on("socket:ready", onSocketReady);

        socket.on("world:baseline", onWorldBaseline);
        socket.on("entity:spawn", onEntitySpawn);
        socket.on("entity:despawn", onEntityDespawn);
        socket.on("entity:delta", onEntityDelta);

        socket.on("move:state", onMoveState);
        socket.on("session:replaced", onSessionReplaced);
        socket.on("connect_error", onConnectError);

        socket.on("inv:full", onInvFull);
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
      }

      disconnectSocket();
      socketRef.current = null;

      joinedRef.current = false;
      pendingInvRequestRef.current = false;
      selectedTargetRef.current = null;
    };
  }, [requestInventoryFull]);

  const selfVitals = useMemo(() => {
    return pickBestSelfVitals(snapshot, (() => {
      const store = worldStoreRef.current;
      const selfId = store?.selfId ? String(store.selfId) : null;
      if (!selfId) return null;
      return store.entities.get(selfId) ?? null;
    })());
  }, [snapshot]);

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

      <div
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 1100,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <HPBar
          visible={true}
          mode="hud"
          width={220}
          hpHeight={18}
          staminaHeight={12}
          hpCurrent={selfVitals.hp.current}
          hpMax={selfVitals.hp.max}
          staminaCurrent={selfVitals.stamina.current}
          staminaMax={selfVitals.stamina.max}
          showHpText={true}
          showStamina={true}
          showStaminaText={true}
        />
      </div>

      <InventoryModal
        open={inventoryOpen}
        snapshot={inventorySnapshot}
        onClose={closeInventory}
      />
    </>
  );
}