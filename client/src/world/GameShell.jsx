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
import { useEffect, useRef, useState } from "react";
import { GameCanvas } from "./scene/GameCanvas";
import { bootstrapWorld } from "@/services/World";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay";
import { connectSocket, disconnectSocket } from "@/services/Socket";
import { createEntitiesStore } from "./state/entitiesStore";

// FIX: normaliza IDs para string no recebimento
const DEBUG_IDS = false;
const toId = (raw) => (raw == null ? null : String(raw));
function debugIds(...args) {
  if (!DEBUG_IDS) return;
  console.log("[GAMESHELL][IDS]", ...args);
}

export function GameShell() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [sessionReplaced, setSessionReplaced] = useState(null); // { userId, by } ou string

  const socketRef = useRef(null);

  // Store autoritativo para entidades replicadas (baseline/delta/spawn/despawn)
  const worldStoreRef = useRef(null);
  if (!worldStoreRef.current) {
    worldStoreRef.current = createEntitiesStore();
  }

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      console.log("[GAMESHELL] bootstrap start");
      try {
        const data = await bootstrapWorld(token);
        console.log("[GAMESHELL] bootstrap done", data);

        if (!data || data?.error) {
          console.error("[GAMESHELL] bootstrap error:", data);

          if (data?.status === 401) {
            localStorage.removeItem("token");
            window.location.reload();
            return;
          }

          return;
        }

        // 1) snapshot inicial (canônico)
        setSnapshot(data.snapshot);
        console.log("[GAMESHELL] snapshot set", data.snapshot);

        // 2) socket entra DEPOIS do snapshot existir
        const socket = connectSocket(token);
        socketRef.current = socket;

        const store = worldStoreRef.current;

        // ---- handlers (mantidos como funções para off correto) ----
        const onSocketReady = (payload) => {
          if (payload?.ok !== true) return;
          socket.emit("world:join");
        };

        const onWorldBaseline = (payload) => {
          // baseline é a verdade completa do interesse atual
          store.applyBaseline(payload);

          // compat: se baseline vier com "you" e já tiver entidade, mantém runtime do snapshot coerente
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
          // payload pode ser { entity } ou a entidade direta
          let entity = payload?.entity ?? payload;
          const entityId = toId(entity?.entityId ?? entity?.id ?? entity?.entity_id ?? null);

          // FIX: evita tratar self como "other" em spawn
          if (entityId && String(entityId) === String(store.selfId)) {
            debugIds("spawn: skip self", entityId);
            return;
          }

          if (entity && typeof entity === "object" && entityId) {
            // FIX: normaliza entityId antes de enviar ao store
            entity = { ...entity, entityId };
          }

          store.applySpawn(entity);
        };

        const onEntityDespawn = (payload) => {
          const entityId = toId(payload?.entityId ?? payload?.id ?? payload);

          // FIX: evita tratar self como "other" em despawn
          if (entityId && String(entityId) === String(store.selfId)) {
            debugIds("despawn: skip self", entityId);
            return;
          }

          store.applyDespawn(entityId);
        };

        const onEntityDelta = (payload) => {
          store.applyDelta(payload);

          // compat: mantém snapshot.runtime do self alinhado com a verdade (para legado)
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

        // 3) legado: estado confirmado do servidor -> também alimenta o store (transição suave)
        const onMoveState = (payload) => {
          // Mantém o comportamento atual (snapshot.runtime)…
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

          // …e espelha no store como delta do self (se já souber selfId).
          const selfId = toId(payload?.entityId ?? store.selfId);
          if (!selfId) return;

          const rev = payload?.rev;
          if (rev == null) return; // sem rev, não arrisca aplicar

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
            if (s) {
              s.removeAllListeners();
            }
          } catch {}
          disconnectSocket();
          socketRef.current = null;

          // opcional (hard logout)
          // localStorage.removeItem("token");

          store.clear();
        };

        const onConnectError = (err) => {
          console.error("[SOCKET] connect_error:", err?.message || err);
        };

        // ---- listeners ----
        socket.on("socket:ready", onSocketReady);

        socket.on("world:baseline", onWorldBaseline);
        socket.on("entity:spawn", onEntitySpawn);
        socket.on("entity:despawn", onEntityDespawn);
        socket.on("entity:delta", onEntityDelta);

        socket.on("move:state", onMoveState);
        socket.on("session:replaced", onSessionReplaced);
        socket.on("connect_error", onConnectError);

        // ---- cleanup ----
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
          }
          disconnectSocket();
          socketRef.current = null;
        };
      } catch (err) {
        console.error("[GAMESHELL] exception:", err);
      } finally {
        setLoading(false);
        console.log("[GAMESHELL] loading=false");
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
    <GameCanvas
      snapshot={snapshot}
      socket={socketRef.current}
      worldStoreRef={worldStoreRef}
    />
  );
}
