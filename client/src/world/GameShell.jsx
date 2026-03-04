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

// FIX: normaliza IDs para string no recebimento
const DEBUG_IDS = false;
const toId = (raw) => (raw == null ? null : String(raw));
function debugIds(...args) {
  if (!DEBUG_IDS) return;
  // console.log(...args);
}

export function GameShell() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [sessionReplaced, setSessionReplaced] = useState(null);

  // UI state do runtime (inventário)
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // snapshot autoritativo do inventário (vem do servidor)
  const [inventorySnapshot, setInventorySnapshot] = useState(null);

  const socketRef = useRef(null);

  // (NOVO) gate: inventário via socket só depois do join confirmado
  const joinedRef = useRef(false);

  // evita “perder” request se inventário abrir antes do join
  const pendingInvRequestRef = useRef(false);

  // (NOVO) seleção atual (alvo clicado) - não autoritativo; é "hint" pro servidor
  // { kind: "ACTOR"|"PLAYER", id: "123" } | null
  const selectedTargetRef = useRef(null);

  // Store autoritativo para entidades replicadas (baseline/delta/spawn/despawn)
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

    // Se houver target selecionado, envia como sugestão.
    // O servidor pode ignorar (fora de range/visibilidade/invalid).
    const t = selectedTargetRef.current;
    if (t?.kind && t?.id) {
      s.emit("interact:start", { target: { kind: String(t.kind), id: String(t.id) } });
    } else {
      // Sem alvo: servidor escolhe nearest (fallback)
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

  const handleInputIntent = useCallback(
    (intent) => {
      if (!intent || typeof intent !== "object") return;

      // UI inventory
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

      // (NOVO) SPACE hold: start/stop interação (aproximar e agir)
      if (intent.type === IntentType.INTERACT_PRIMARY_DOWN) {
        emitInteractStart();
        return;
      }

      if (intent.type === IntentType.INTERACT_PRIMARY_UP) {
        emitInteractStop();
        return;
      }

      // (NOVO) seleção de alvo via canvas
      if (intent.type === IntentType.TARGET_SELECT) {
        const kind = intent?.target?.kind;
        const id = intent?.target?.id;
        if (kind && id != null) {
          selectedTargetRef.current = { kind: String(kind), id: String(id) };
        }
        return;
      }

      if (intent.type === IntentType.TARGET_CLEAR) {
        selectedTargetRef.current = null;
        return;
      }
    },
    [requestInventoryFull, emitInteractStart, emitInteractStop]
  );

  const closeInventory = useCallback(() => {
    setInventoryOpen(false);
  }, []);

  // (NOVO) handlers de seleção vindos do GameCanvas
  const onTargetSelect = useCallback((target) => {
    // target: { kind: "ACTOR"|"PLAYER", id: string }
    if (!target?.kind || target?.id == null) return;
    selectedTargetRef.current = { kind: String(target.kind), id: String(target.id) };
  }, []);

  const onTargetClear = useCallback(() => {
    selectedTargetRef.current = null;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await bootstrapWorld(token);

        // ✅ seed: inventário autoritativo já vem no bootstrap
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

        // 1) snapshot inicial (canônico)
        setSnapshot(data.snapshot);

        // 2) socket entra DEPOIS do snapshot existir
        const socket = connectSocket(token);
        socketRef.current = socket;

        // reset gates (novo socket)
        joinedRef.current = false;
        pendingInvRequestRef.current = false;

        const store = worldStoreRef.current;

        const onInvFull = (payload) => {
          const inv = payload?.ok === true ? payload : payload ?? { ok: false };
          logInventory("SOCKET_INV_FULL", inv);

          // ✅ não sobrescreve snapshot bom com erro
          if (inv?.ok === true) {
            setInventorySnapshot(inv);
          } else {
            console.warn("[INV] inv:full not ok (ignored)", inv?.error);
          }
        };

        const onSocketReady = (payload) => {
          if (payload?.ok !== true) return;

          // ✅ join COM ack
          socket.emit("world:join", {}, (ack) => {
            if (ack?.ok === false) return;

            joinedRef.current = true;

            // flush pendência se inventário já estiver aberto
            if (inventoryOpen) {
              pendingInvRequestRef.current = true;
              const ok = requestInventoryFull();
              if (ok) pendingInvRequestRef.current = false;
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
              },
            };
          });
        };

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
          if (!entityId) return;

          if (String(entityId) !== String(selfId)) return;

          const self = store.entities.get(String(selfId));
          if (!self) return;

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
              },
            };
          });
        };

        const onMoveState = (payload) => {
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
            action: payload?.action,
          });
        };

        const onSessionReplaced = (payload) => {
          setSessionReplaced(payload ?? { reason: "session_replaced" });
          try {
            const s = socketRef.current;
            if (s) s.removeAllListeners();
          } catch {}
          disconnectSocket();
          socketRef.current = null;
          store.clear();
        };

        const onConnectError = (err) => {
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

        return () => {
          const s = socketRef.current;
          if (s) {
            s.off("socket:ready", onSocketReady);

            s.off("world:baseline", onWorldBaseline);
            s.off("entity:spawn", onEntitySpawn);
            s.off("entity:despawn", onEntityDespawn);
            s.off("entity:delta", onEntityDelta);

            s.off("move:state", onMoveState);
            s.off("session:replaced", onSessionReplaced);
            s.off("connect_error", onConnectError);

            s.off("inv:full", onInvFull);
          }
          disconnectSocket();
          socketRef.current = null;

          joinedRef.current = false;
          pendingInvRequestRef.current = false;

          selectedTargetRef.current = null;
        };
      } catch (err) {
        console.error("[GAMESHELL] exception:", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        socket={socketRef.current}
        worldStoreRef={worldStoreRef}
        onInputIntent={handleInputIntent}
        // (NOVO) seleção de alvo (GameCanvas resolve raycast e chama isso)
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