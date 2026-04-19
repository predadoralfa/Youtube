import { useEffect, useRef } from "react";
import { bootstrapWorld } from "@/services/World";
import { connectSocket, disconnectSocket } from "@/services/Socket";
import { logInventory } from "@/inventory/inventoryProbe";
import { createInventoryHandlers } from "./inventoryHandlers";
import { createWorldHandlers } from "./worldHandlers";
import { createEntityHandlers } from "./entityHandlers";

export function useGameShellSocket(state, requestInventoryFull) {
  const mountedRef = useRef(false);
  const {
    setLoading,
    setInventorySnapshot,
    setEquipmentSnapshot,
    setSnapshot,
    socketRef,
    joinedRef,
    pendingInvRequestRef,
    worldStoreRef,
    selectedTargetRef,
    combatTargetRef,
  } = state;

  useEffect(() => {
    mountedRef.current = true;
    let localSocket = null;

    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    const boot = async () => {
      try {
        const data = await bootstrapWorld(token);

        if (!mountedRef.current) return;

        logInventory("BOOTSTRAP_HTTP", data?.inventory);
        if (data?.inventory?.ok === true) {
          setInventorySnapshot(data.inventory);
          if (data.inventory?.equipment?.ok === true) {
            setEquipmentSnapshot(data.inventory.equipment);
          }
        }

        if (data?.equipment?.ok === true) {
          setEquipmentSnapshot(data.equipment);
        }

        if (!data || data?.error) {
          if (data?.status === 401) {
            localStorage.removeItem("token");
            window.location.reload();
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
        const handlers = {
          ...createInventoryHandlers(state),
          ...createWorldHandlers(state, requestInventoryFull, socket, store, mountedRef),
          ...createEntityHandlers(state, store),
        };

        socket.on("socket:ready", handlers.onSocketReady);
        socket.on("world:baseline", handlers.onWorldBaseline);
        socket.on("entity:spawn", handlers.onEntitySpawn);
        socket.on("entity:despawn", handlers.onEntityDespawn);
        socket.on("entity:delta", handlers.onEntityDelta);
        socket.on("move:state", handlers.onMoveState);
        socket.on("session:replaced", handlers.onSessionReplaced);
        socket.on("connect_error", handlers.onConnectError);
        socket.on("inv:full", handlers.onInvFull);
        socket.on("research:full", handlers.onResearchFull);
        socket.on("equipment:full", handlers.onEquipmentFull);
        socket.on("world:object_spawn", handlers.onWorldObjectSpawn);
        socket.on("world:object_despawn", handlers.onWorldObjectDespawn);
        socket.on("actor:collected", handlers.onActorCollected);
        socket.on("actor:updated", handlers.onActorUpdated);
        socket.on("combat:enemy_attack", handlers.onEnemyAttack);

        socket.__gameShellHandlers = handlers;
      } catch (err) {
        if (!mountedRef.current) return;
        console.error("[GAMESHELL] exception:", err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    boot();

    return () => {
      mountedRef.current = false;

      const socket = localSocket || socketRef.current;
      const handlers = socket?.__gameShellHandlers ?? null;
      if (socket && handlers) {
        socket.off("socket:ready", handlers.onSocketReady);
        socket.off("world:baseline", handlers.onWorldBaseline);
        socket.off("entity:spawn", handlers.onEntitySpawn);
        socket.off("entity:despawn", handlers.onEntityDespawn);
        socket.off("entity:delta", handlers.onEntityDelta);
        socket.off("move:state", handlers.onMoveState);
        socket.off("session:replaced", handlers.onSessionReplaced);
        socket.off("connect_error", handlers.onConnectError);
        socket.off("inv:full", handlers.onInvFull);
        socket.off("research:full", handlers.onResearchFull);
        socket.off("equipment:full", handlers.onEquipmentFull);
        socket.off("world:object_spawn", handlers.onWorldObjectSpawn);
        socket.off("world:object_despawn", handlers.onWorldObjectDespawn);
        socket.off("actor:collected", handlers.onActorCollected);
        socket.off("actor:updated", handlers.onActorUpdated);
        socket.off("combat:enemy_attack", handlers.onEnemyAttack);
        delete socket.__gameShellHandlers;
      }

      disconnectSocket();
      socketRef.current = null;
      joinedRef.current = false;
      pendingInvRequestRef.current = false;
      selectedTargetRef.current = null;
      combatTargetRef.current = null;
    };
  }, [
    requestInventoryFull,
    setLoading,
    setInventorySnapshot,
    setEquipmentSnapshot,
    setSnapshot,
    socketRef,
    joinedRef,
    pendingInvRequestRef,
    worldStoreRef,
    selectedTargetRef,
    combatTargetRef,
  ]);
}
