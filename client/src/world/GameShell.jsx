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
import { BuildModal } from "@/components/models/build/BuildModal";
import { ResearchModal } from "@/components/models/research/ResearchModal";
import { WorldClockPanel } from "@/world/ui/WorldClockPanel";

const DEBUG_IDS = false;

const toId = (raw) => (raw == null ? null : String(raw));

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDisplayInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function buildInventoryTotals(snapshot) {
  const containers = Array.isArray(snapshot?.containers) ? snapshot.containers : [];
  const itemInstances = Array.isArray(snapshot?.itemInstances) ? snapshot.itemInstances : [];
  const itemDefs = Array.isArray(snapshot?.itemDefs) ? snapshot.itemDefs : [];

  const itemInstanceById = new Map(
    itemInstances
      .filter((it) => it?.id != null)
      .map((it) => [String(it.id), it])
  );

  const itemDefById = new Map(
    itemDefs
      .filter((def) => def?.id != null)
      .map((def) => [String(def.id), def])
  );

  const totals = new Map();

  for (const container of containers) {
    const slots = Array.isArray(container?.slots) ? container.slots : [];
    for (const slot of slots) {
      const itemInstanceId = slot?.itemInstanceId;
      if (itemInstanceId == null) continue;

      const inst = itemInstanceById.get(String(itemInstanceId));
      if (!inst) continue;

      const def = itemDefById.get(String(inst.itemDefId)) ?? null;
      const itemDefId = String(inst.itemDefId ?? "unknown");
      const qty = toDisplayInt(slot?.qty ?? 0, 0);
      if (qty <= 0) continue;

      const current = totals.get(itemDefId) ?? {
        itemDefId,
        qty: 0,
        name: def?.name ?? `Item ${itemDefId}`,
      };

      current.qty += qty;
      if (!current.name && def?.name) current.name = def.name;
      totals.set(itemDefId, current);
    }
  }

  return totals;
}

function buildLootNotifications(prevSnapshot, nextSnapshot) {
  if (!nextSnapshot) return [];

  const prevTotals = buildInventoryTotals(prevSnapshot);
  const nextTotals = buildInventoryTotals(nextSnapshot);
  const now = Date.now();

  const messages = [];
  for (const [itemDefId, nextEntry] of nextTotals.entries()) {
    const prevQty = prevTotals.get(itemDefId)?.qty ?? 0;
    const deltaQty = Number(nextEntry.qty ?? 0) - Number(prevQty ?? 0);
    if (deltaQty <= 0) continue;

    messages.push({
      id: `loot:${itemDefId}:${now}:${Math.random().toString(36).slice(2, 8)}`,
      text: `+${deltaQty} ${nextEntry.name ?? `Item ${itemDefId}`}`,
      startedAt: now,
      ttlMs: 1400,
    });
  }

  return messages;
}

function mergeSnapshotActor(prevSnapshot, actorUpdate) {
  if (!prevSnapshot || !actorUpdate) return prevSnapshot;

  const actorId = toId(actorUpdate?.id ?? actorUpdate?.actorId ?? actorUpdate?.actor?.id ?? null);
  if (!actorId) return prevSnapshot;

  const nextActorPatch = actorUpdate?.actor ?? actorUpdate;
  const actors = Array.isArray(prevSnapshot.actors) ? prevSnapshot.actors : [];
  let changed = false;

  const nextActors = actors.map((actor) => {
    if (toId(actor?.id ?? null) !== actorId) return actor;
    changed = true;
    return {
      ...actor,
      ...nextActorPatch,
      id: actor?.id ?? nextActorPatch?.id ?? actorId,
    };
  });

  if (!changed) return prevSnapshot;

  return {
    ...prevSnapshot,
    actors: nextActors,
  };
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

  const hungerCurrent =
    raw?.vitals?.hunger?.current ??
    raw?.hungerCurrent ??
    raw?.hunger_current ??
    0;

  const hungerMax =
    raw?.vitals?.hunger?.max ??
    raw?.hungerMax ??
    raw?.hunger_max ??
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
    hunger: {
      current: toDisplayInt(hungerCurrent, 0),
      max: toDisplayInt(hungerMax, 0),
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
    hunger: { current: 0, max: 0 },
  };
}

export function GameShell() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [sessionReplaced, setSessionReplaced] = useState(null);

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [inventorySnapshot, setInventorySnapshot] = useState(null);
  const [equipmentSnapshot, setEquipmentSnapshot] = useState(null);
  const [inventoryMessage, setInventoryMessage] = useState(null);
  const [equipmentMessage, setEquipmentMessage] = useState(null);
  const [researchMessage, setResearchMessage] = useState(null);
  const [lootNotifications, setLootNotifications] = useState([]);

  const socketRef = useRef(null);
  const joinedRef = useRef(false);
  const pendingInvRequestRef = useRef(false);
  const inventorySnapshotRef = useRef(null);

  // { kind: "ACTOR"|"PLAYER"|"ENEMY", id: "123" } | null
  const selectedTargetRef = useRef(null);

  // ✨ NOVO: Rastrear estado de combate com inimigo
  // Detecta qual inimigo já teve interact:start enviado
  const combatTargetRef = useRef(null);

  const worldStoreRef = useRef(null);
  if (!worldStoreRef.current) {
    worldStoreRef.current = createEntitiesStore();
  }
  const selfVitals = useMemo(() => pickBestSelfVitals(snapshot, null), [snapshot]);

  useEffect(() => {
    inventorySnapshotRef.current = inventorySnapshot ?? null;
  }, [inventorySnapshot]);

  const requestInventoryFull = useCallback(() => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    s.emit("inv:request_full", { reason: "ui_open" });
    return true;
  }, []);

  const requestResearchFull = useCallback(() => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    s.emit("research:request_full", { reason: "ui_open" });
    return true;
  }, []);

  const emitEquipmentAction = useCallback((eventName, payload) => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    s.emit(eventName, payload, (ack) => {
      if (ack?.ok === true && ack?.equipment?.ok === true) {
        setEquipmentSnapshot(ack.equipment);
        setEquipmentMessage(null);
        return;
      }

      if (ack?.ok === true) {
        setEquipmentMessage(null);
        return;
      }

      setEquipmentMessage(ack?.message || ack?.code || "Falha ao atualizar equipment");
    });

    return true;
  }, []);

  const emitInventoryDrop = useCallback((itemInstanceId) => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    setInventoryMessage(null);

    s.emit("inv:drop", { itemInstanceId: String(itemInstanceId) }, (ack) => {
      if (ack?.ok === true && ack?.inventory?.ok === true) {
        setInventorySnapshot(ack.inventory);
        if (ack.inventory?.equipment?.ok === true) {
          setEquipmentSnapshot(ack.inventory.equipment);
        }
        setInventoryMessage(null);
        return;
      }

      if (ack?.ok === false) {
        setInventoryMessage(ack?.message || ack?.code || "Falha ao dropar item");
      }
    });

    return true;
  }, []);

  const emitInventoryAction = useCallback((eventName, payload) => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    setInventoryMessage(null);

    s.emit(eventName, payload, (ack) => {
      if (ack?.ok === true && ack?.inventory?.ok === true) {
        setInventorySnapshot(ack.inventory);
        if (ack.inventory?.equipment?.ok === true) {
          setEquipmentSnapshot(ack.inventory.equipment);
        }
        setInventoryMessage(null);
        return;
      }

      if (ack?.ok === false) {
        setInventoryMessage(ack?.message || ack?.code || "Falha ao atualizar inventário");
      }
    });

    return true;
  }, []);

  const emitResearchStart = useCallback((researchCode) => {
    const s = socketRef.current;
    if (!s) return false;
    if (!joinedRef.current) return false;

    setResearchMessage(null);

    s.emit("research:start", { researchCode: String(researchCode) }, (ack) => {
      if (ack?.ok === true && ack?.research?.ok === true) {
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                research: ack.research,
              }
            : prev
        );
        requestInventoryFull();
        setResearchMessage(null);
        return;
      }

      if (ack?.ok === false) {
        setResearchMessage(ack?.message || ack?.code || "Falha ao iniciar estudo");
      }
    });

    return true;
  }, []);

  const onPickupInventoryItem = useCallback(
    ({ containerId, slotIndex }) => {
      return emitInventoryAction("inv:pickup", {
        containerId: String(containerId),
        slotIndex: Number(slotIndex),
      });
    },
    [emitInventoryAction]
  );

  const onPlaceHeldItem = useCallback(
    ({ containerId, slotIndex }) => {
      return emitInventoryAction("inv:place", {
        containerId: String(containerId),
        slotIndex: Number(slotIndex),
      });
    },
    [emitInventoryAction]
  );

  const onSplitInventoryItem = useCallback(
    ({ containerId, slotIndex, qty }) => {
      return emitInventoryAction("inv:split", {
        containerId: String(containerId),
        slotIndex: Number(slotIndex),
        qty: Number(qty),
      });
    },
    [emitInventoryAction]
  );

  const onMoveInventoryItem = useCallback(
    ({ fromRole, fromSlotIndex, toRole, toSlotIndex, qty }) => {
      return emitInventoryAction("inv:move", {
        from: {
          role: String(fromRole),
          slot: Number(fromSlotIndex),
          slotIndex: Number(fromSlotIndex),
        },
        to: {
          role: String(toRole),
          slot: Number(toSlotIndex),
          slotIndex: Number(toSlotIndex),
        },
        qty: qty == null ? 1 : Number(qty),
      });
    },
    [emitInventoryAction]
  );

  const onCancelHeldState = useCallback(() => {
    return emitInventoryAction("inv:cancel", {});
  }, [emitInventoryAction]);

  const onSetAutoFoodMacro = useCallback(
    ({ itemInstanceId, hungerThreshold }) => {
      return emitInventoryAction("inv:auto_food:set", {
        itemInstanceId: itemInstanceId == null ? null : String(itemInstanceId),
        hungerThreshold: Number(hungerThreshold),
      });
    },
    [emitInventoryAction]
  );

  const onEquipItemToSlot = useCallback(
    ({ itemInstanceId, slotCode }) => {
      return emitEquipmentAction("equipment:equip", {
        itemInstanceId: String(itemInstanceId),
        slotCode: String(slotCode),
      });
    },
    [emitEquipmentAction]
  );

  const onUnequipItemFromSlot = useCallback(
    ({ slotCode }) => {
      return emitEquipmentAction("equipment:unequip", {
        slotCode: String(slotCode),
      });
    },
    [emitEquipmentAction]
  );

  const onSwapEquipmentSlots = useCallback(
    ({ fromSlotCode, toSlotCode }) => {
      return emitEquipmentAction("equipment:swap", {
        fromSlotCode: String(fromSlotCode),
        toSlotCode: String(toSlotCode),
      });
    },
    [emitEquipmentAction]
  );

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

  const closeResearch = useCallback(() => {
    setResearchOpen(false);
  }, []);

  const closeBuild = useCallback(() => {
    setBuildOpen(false);
  }, []);

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
            setResearchOpen(false);
          }

          if (next) {
            pendingInvRequestRef.current = true;
            const ok = requestInventoryFull();
            if (ok) pendingInvRequestRef.current = false;
          }

          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_TOGGLE_RESEARCH) {
        setResearchOpen((prev) => {
          const next = !prev;
          if (next) {
            setInventoryOpen(false);
            setBuildOpen(false);
            requestInventoryFull();
            requestResearchFull();
          }
          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_TOGGLE_BUILD) {
        setBuildOpen((prev) => {
          const next = !prev;
          if (next) {
            setInventoryOpen(false);
            setResearchOpen(false);
          }
          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_CANCEL) {
        if (buildOpen) {
          closeBuild();
          return;
        }

        if (researchOpen) {
          closeResearch();
          return;
        }

        if (inventoryOpen) {
          closeInventory();
          return;
        }

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
        if (!target?.kind || target.kind !== "ENEMY") {
          emitInteractStop();
        }
        return;
      }
    },
    [
      requestInventoryFull,
      requestResearchFull,
      emitInteractStart,
      emitInteractStop,
      inventoryOpen,
      researchOpen,
      buildOpen,
      closeInventory,
      closeResearch,
      closeBuild,
    ]
  );

  useEffect(() => {
    let mounted = true;
    let localSocket = null;

    let onInvFull = null;
    let onResearchFull = null;
    let onSocketReady = null;
    let onWorldBaseline = null;
    let onEntitySpawn = null;
    let onEntityDespawn = null;
    let onEntityDelta = null;
    let onMoveState = null;
    let onSessionReplaced = null;
    let onConnectError = null;
    let onEnemyAttack = null;
    let onWorldObjectSpawn = null;
    let onEquipmentFull = null;
    let onActorCollected = null;
    let onActorUpdated = null;

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
            if (inv?.equipment?.ok === true) {
              setEquipmentSnapshot(inv.equipment);
            }
          }
        };

        onResearchFull = (payload) => {
          const research = payload?.ok === true ? payload : payload ?? { ok: false };
          if (research?.ok === true) {
            setSnapshot((prev) =>
              prev
                ? {
                    ...prev,
                    research,
                  }
                : prev
            );
            setResearchMessage(null);
          }
        };

        onEquipmentFull = (payload) => {
          const equipment = payload?.ok === true ? payload : payload ?? { ok: false };
          if (equipment?.ok === true) {
            setEquipmentSnapshot(equipment);
            setEquipmentMessage(null);
          }
        };

        onWorldObjectSpawn = (payload) => {
          const actor = payload?.actor ?? payload?.object ?? payload ?? null;
          const actorId = toId(actor?.id ?? actor?.actorId ?? actor?.actor_id ?? null);
          if (!actorId) return;

          const normalizedState = parseMaybeJsonObject(actor?.state ?? actor?.state_json ?? null);
          const looksLikeItemDrop =
            normalizedState?.dropSource != null ||
            normalizedState?.sourceKind != null ||
            normalizedState?.itemInstanceId != null ||
            normalizedState?.itemDefId != null ||
            normalizedState?.itemCode != null;

          const normalizedActor = {
            ...actor,
            id: actorId,
            actorType: actor?.actorDefCode === "GROUND_LOOT" || actor?.actorType === "GROUND_LOOT" || actor?.actor_type === "GROUND_LOOT"
              ? "GROUND_LOOT"
              : looksLikeItemDrop
              ? "ITEM_DROP"
              : (actor?.actorDefCode ?? actor?.actorType ?? actor?.actor_type ?? "CHEST"),
            actorDefCode: actor?.actorDefCode ?? actor?.actorType ?? actor?.actor_type ?? null,
            actorKind: actor?.actorKind ?? null,
            visualHint: actor?.visualHint ?? null,
            instanceId: Number(actor?.instanceId ?? actor?.instance_id ?? store.instanceId ?? 0),
            state: normalizedState,
            pos: {
              x: Number(actor?.pos?.x ?? actor?.position?.x ?? 0),
              y: Number(actor?.pos?.y ?? actor?.position?.y ?? 0),
              z: Number(actor?.pos?.z ?? actor?.position?.z ?? 0),
            },
          };
          console.log("[DROP_TRACE] world:object_spawn actor", {
            actorId,
            actorType: normalizedActor.actorType,
            state: normalizedActor.state,
          });

          setSnapshot((prev) => {
            if (!prev) return prev;
            const actors = Array.isArray(prev.actors) ? prev.actors : [];
            if (actors.some((a) => String(a.id) === String(actorId))) return prev;

            return {
              ...prev,
              actors: [...actors, normalizedActor],
            };
          });
        };

        onActorCollected = (payload) => {
          const actorId = toId(payload?.actorId ?? null);
          const actorDisabled = Boolean(payload?.actorDisabled);
          const inventoryFull = payload?.inventory ?? payload?.inventoryFull ?? null;
          const lootInfo = payload?.loot ?? null;
          const actorMessage = payload?.message ?? null;
          console.log("[LOOT_TRACE] actor:collected received", {
            actorId,
            actorDisabled,
            hasInventory: inventoryFull?.ok === true,
            hasLoot: Boolean(lootInfo),
          });
          if (!actorId) return;

          if (inventoryFull?.ok === true) {
            const lootMessages = lootInfo?.qty > 0
              ? [{
                  id: `loot:${actorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
                  text: `+${Number(lootInfo.qty)} ${lootInfo.itemName ?? lootInfo.itemDefId ?? "Loot"}`,
                  startedAt: Date.now(),
                  ttlMs: 1400,
                }]
              : buildLootNotifications(
                  inventorySnapshotRef.current,
                  inventoryFull
                );
            console.log("[LOOT_TRACE] loot delta", {
              prevInventoryOk: Boolean(inventorySnapshotRef.current?.ok === true),
              lootCount: lootMessages.length,
              lootMessages,
            });
            if (lootMessages.length > 0) {
              setLootNotifications((current) => [
                ...current,
                ...lootMessages,
              ].slice(-8));
            }
            setInventorySnapshot(inventoryFull);
            if (inventoryFull?.equipment?.ok === true) {
              setEquipmentSnapshot(inventoryFull.equipment);
            }
            setInventoryMessage(null);
            console.log("[LOOT_TRACE] inventory snapshot updated", {
              lootCount: lootMessages.length,
            });
          }

          if (actorMessage) {
            setInventoryMessage(actorMessage);
            setLootNotifications((current) => [
              ...current,
              {
                id: `actor-msg:${actorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
                text: actorMessage,
                startedAt: Date.now(),
                ttlMs: 1800,
              },
            ].slice(-8));
          }

          setSnapshot((prev) => {
            let next = prev;

            if (payload?.actorUpdate) {
              next = mergeSnapshotActor(next, payload.actorUpdate);
            }

            if (!next) return next;
            if (!actorDisabled) return next;

            const actors = Array.isArray(next.actors) ? next.actors : [];
            if (!actors.some((a) => String(a.id) === String(actorId))) return next;

            return {
              ...next,
              actors: actors.filter((a) => String(a.id) !== String(actorId)),
            };
          });
        };

        onActorUpdated = (payload) => {
          const actorUpdate = payload?.actor ?? payload?.entity ?? payload ?? null;
          setSnapshot((prev) => mergeSnapshotActor(prev, actorUpdate));
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
                cameraPitch:
                  payload?.runtime?.cameraPitch ??
                  payload?.runtime?.camera_pitch ??
                  prev.runtime.cameraPitch ??
                  prev.runtime.camera_pitch,
                cameraDistance:
                  payload?.runtime?.cameraDistance ??
                  payload?.runtime?.camera_distance ??
                  prev.runtime.cameraDistance ??
                  prev.runtime.camera_distance,
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
                cameraPitch:
                  payload?.cameraPitch ??
                  payload?.camera_pitch ??
                  prev.runtime.cameraPitch ??
                  prev.runtime.camera_pitch,
                cameraDistance:
                  payload?.cameraDistance ??
                  payload?.camera_distance ??
                  prev.runtime.cameraDistance ??
                  prev.runtime.camera_distance,
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
              hunger: currentVitals?.hunger ?? { current: 0, max: 0 },
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
        socket.on("research:full", onResearchFull);
        socket.on("equipment:full", onEquipmentFull);
        socket.on("world:object_spawn", onWorldObjectSpawn);
        socket.on("actor:collected", onActorCollected);
        socket.on("actor:updated", onActorUpdated);
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
        if (onResearchFull) s.off("research:full", onResearchFull);
        if (onEquipmentFull) s.off("equipment:full", onEquipmentFull);
        if (onWorldObjectSpawn) s.off("world:object_spawn", onWorldObjectSpawn);
        if (onActorCollected) s.off("actor:collected", onActorCollected);
        if (onActorUpdated) s.off("actor:updated", onActorUpdated);
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
        worldClock={snapshot?.worldClock}
        worldStoreRef={worldStoreRef}
        onInputIntent={handleInputIntent}
        onTargetSelect={onTargetSelect}
        onTargetClear={onTargetClear}
        lootNotifications={lootNotifications}
      />

      <WorldClockPanel worldClock={snapshot?.worldClock} />

      <InventoryModal
        open={inventoryOpen}
          snapshot={inventorySnapshot}
          equipmentSnapshot={equipmentSnapshot}
          selfVitals={selfVitals}
          inventoryMessage={inventoryMessage}
          equipmentMessage={equipmentMessage}
          onClose={closeInventory}
          onCancelHeldState={onCancelHeldState}
          onPickupInventoryItem={onPickupInventoryItem}
          onPlaceHeldItem={onPlaceHeldItem}
          onSplitInventoryItem={onSplitInventoryItem}
          onMoveInventoryItem={onMoveInventoryItem}
          onEquipItemToSlot={onEquipItemToSlot}
          onUnequipItemFromSlot={onUnequipItemFromSlot}
          onSwapEquipmentSlots={onSwapEquipmentSlots}
          onDropItemToWorld={emitInventoryDrop}
          onSetAutoFoodMacro={onSetAutoFoodMacro}
        />

      <ResearchModal
        open={researchOpen}
        snapshot={snapshot?.research}
        inventorySnapshot={inventorySnapshot}
        equipmentSnapshot={equipmentSnapshot}
        researchMessage={researchMessage}
        onClose={closeResearch}
        onStartStudy={emitResearchStart}
        onRequestInventoryFull={requestInventoryFull}
      />

      <BuildModal open={buildOpen} onClose={closeBuild} />
    </>
  );
}
