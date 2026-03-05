// cliente/src/World/hooks/useActorCollection.js
import { useEffect } from "react";

/**
 * useActorCollection
 *
 * Hook que gerencia a coleta de items de actors (BAU).
 * - Escuta evento "actor:collected" do socket
 * - Atualiza inventário com novo payload
 * - Remove ator da cena se ficar vazio (actorDisabled=true)
 * - Callback opcional para feedback visual (cooldown bar)
 *
 * Params:
 * - socket: Socket.IO instance
 * - onInventoryUpdate: (inventory) => void (callback quando inventário atualiza)
 * - onActorCollected: (actorId, disabled) => void (callback para UI feedback)
 * - onSnapshotUpdate: (newActors) => void (callback para remover ator do snapshot)
 */
export function useActorCollection({
  socket,
  onInventoryUpdate,
  onActorCollected,
  onSnapshotUpdate,
}) {
  useEffect(() => {
    if (!socket) return;

    const handleActorCollected = (payload) => {
      if (!payload) return;

      const actorId = String(payload?.actorId ?? "");
      const actorDisabled = Boolean(payload?.actorDisabled);
      const inventoryFull = payload?.inventoryFull ?? null;

      console.log("[COLLECT] actor:collected", {
        actorId,
        actorDisabled,
        hasInventory: !!inventoryFull,
      });

      // ✅ Atualizar inventário se recebeu novo payload
      if (inventoryFull?.ok === true && onInventoryUpdate) {
        onInventoryUpdate(inventoryFull);
      }

      // ✅ Se ator ficou vazio/desabilitado, remover da cena
      if (actorDisabled && onSnapshotUpdate) {
        onSnapshotUpdate((prev) => {
          if (!prev || !Array.isArray(prev)) return prev;
          // Remove ator com id que foi coletado
          return prev.filter((a) => String(a.id) !== actorId);
        });
      }

      // ✅ Callback para feedback visual (cooldown bar, animação, etc)
      if (onActorCollected) {
        onActorCollected(actorId, actorDisabled);
      }
    };

    socket.on("actor:collected", handleActorCollected);

    return () => {
      socket.off("actor:collected", handleActorCollected);
    };
  }, [socket, onInventoryUpdate, onActorCollected, onSnapshotUpdate]);
}