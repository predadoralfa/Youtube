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

export function GameShell() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);

  const socketRef = useRef(null);

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

        // 3) estado confirmado do servidor -> atualiza runtime do snapshot
        socket.on("move:state", (payload) => {
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
        });


        socket.on("connect_error", (err) => {
          console.error("[SOCKET] connect_error:", err?.message || err);
        });
      } catch (err) {
        console.error("[GAMESHELL] exception:", err);
      } finally {
        setLoading(false);
        console.log("[GAMESHELL] loading=false");
      }
    })();

    return () => {
      const s = socketRef.current;
      if (s) {
        s.off("move:state");
        s.off("connect_error");
      }
      disconnectSocket();
      socketRef.current = null;
    };
  }, []);

  if (loading) return <LoadingOverlay message="Carregando mundo..." />;
  if (!snapshot) return <LoadingOverlay message="Falha ao carregar mundo" />;

  return <GameCanvas snapshot={snapshot} socket={socketRef.current} />;
}
