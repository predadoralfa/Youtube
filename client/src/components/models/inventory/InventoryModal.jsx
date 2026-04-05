import { useEffect, useMemo, useRef, useState } from "react";
import "@/style/inventoryModal.css";
import { InventoryItemIcon } from "./InventoryItemIcon";

const WEAR_SLOT_ORDER = [
  "HEAD",
  "TORSO",
  "LEGS",
  "FEET",
  "HANDS_WEAR",
  "BACK",
  "BELT",
  "NECK_1",
  "NECK_2",
  "RING_1",
  "RING_2",
];

const WEAR_SLOT_ROWS = [
  ["HEAD", "NECK_1", "NECK_2"],
  ["TORSO", "BACK"],
  ["LEGS", "BELT"],
  ["HANDS_WEAR", "RING_1", "RING_2"],
  ["FEET"],
];

const HANDS_SLOT_ORDER = ["HAND_L", "HAND_R"];
const SIDEBAR_TABS = [
  { id: "equipment", label: "Equipment" },
  { id: "craft", label: "Craft" },
  { id: "macro", label: "Macro" },
];

function toId(raw) {
  return raw == null ? null : String(raw);
}

function getDefIdFromInstance(inst) {
  return inst?.item_def_id ?? inst?.def_id ?? inst?.itemDefId ?? null;
}

function getAllowedSlotsForDef(def) {
  const components = Array.isArray(def?.components) ? def.components : [];
  const equippable = components.find((component) => {
    const type = component?.componentType ?? component?.component_type;
    return type === "EQUIPPABLE";
  });

  const data = equippable?.dataJson ?? equippable?.data_json ?? null;
  const allowedSlots = Array.isArray(data?.allowedSlots) ? data.allowedSlots : [];

  return allowedSlots.map((slot) => String(slot)).filter(Boolean);
}

function getItemLabel(inst, def) {
  if (!inst && !def) return "Unknown";
  if (def?.name) return def.name;
  if (def?.code) return def.code;
  return inst?.id != null ? `Instance ${inst.id}` : "Item";
}

function buildInventoryIndex(snapshot) {
  const instances = snapshot?.itemInstances || snapshot?.item_instances || [];
  const defs = snapshot?.itemDefs || snapshot?.item_defs || [];

  const instanceMap = new Map();
  for (const inst of instances) {
    const id = inst?.id ?? inst?.instance_id ?? inst?.itemInstanceId;
    if (id != null) instanceMap.set(String(id), inst);
  }

  const defMap = new Map();
  for (const def of defs) {
    const id = def?.id ?? def?.def_id;
    if (id != null) defMap.set(String(id), def);
  }

  return { instanceMap, defMap };
}

function buildEquipmentIndex(snapshot) {
  const slots = Array.isArray(snapshot?.slots) ? snapshot.slots : [];
  const slotMap = new Map();

  for (const slot of slots) {
    const code = slot?.slotCode ?? slot?.slot_code ?? null;
    if (code) slotMap.set(String(code), slot);
  }

  return slotMap;
}

function clampSplitQty(raw, maxQty) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.floor(n)), Math.max(1, maxQty));
}

function formatWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function InventoryModal({
  open,
  snapshot,
  equipmentSnapshot,
  selfVitals,
  inventoryMessage,
  equipmentMessage,
  onClose,
  onCancelHeldState,
  onPickupInventoryItem,
  onPlaceHeldItem,
  onSplitInventoryItem,
  onMoveInventoryItem,
  onEquipItemToSlot,
  onUnequipItemFromSlot,
  onSwapEquipmentSlots,
  onDropItemToWorld,
  onSetAutoFoodMacro,
}) {
  const ok = snapshot?.ok === true;
  const heldState = snapshot?.heldState ?? null;
  const heldStateActive = Boolean(heldState);
  const [dragItem, setDragItem] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [splitDraft, setSplitDraft] = useState(null);
  const [localNotice, setLocalNotice] = useState(null);
  const [dismissedNoticeText, setDismissedNoticeText] = useState(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState("equipment");
  const [macroFoodItemInstanceId, setMacroFoodItemInstanceId] = useState(null);
  const [macroHungerThreshold, setMacroHungerThreshold] = useState(60);
  const dropHandledRef = useRef(false);
  const splitInputRef = useRef(null);

  const inventoryIndex = useMemo(() => buildInventoryIndex(snapshot), [snapshot]);
  const equipmentIndex = useMemo(() => buildEquipmentIndex(equipmentSnapshot), [equipmentSnapshot]);

  const buildSlotList = (slotCodes, fallbackKind) =>
    slotCodes.map((slotCode) => {
      const slot = equipmentIndex.get(slotCode) ?? null;
      return {
        slotCode,
        slotName: slot?.slotName ?? slotCode,
        slotKind: slot?.slotKind ?? fallbackKind,
        itemInstanceId: slot?.itemInstanceId ?? null,
        qty: Number(slot?.qty ?? 0),
        item: slot?.item ?? null,
        sourceContainerId: slot?.sourceContainerId ?? null,
        sourceSlotIndex: slot?.sourceSlotIndex ?? null,
        sourceRole: slot?.sourceRole ?? slotCode,
      };
    });

  const wearSlots = useMemo(() => buildSlotList(WEAR_SLOT_ORDER, "WEAR"), [equipmentIndex]);
  const wearSlotRows = useMemo(
    () =>
      WEAR_SLOT_ROWS.map((row) =>
        row.map((slotCode) => wearSlots.find((slot) => slot.slotCode === slotCode)).filter(Boolean)
      ),
    [wearSlots]
  );
  const handSlots = useMemo(() => buildSlotList(HANDS_SLOT_ORDER, "USAGE"), [equipmentIndex]);

  const debug = useMemo(() => {
    const keys = snapshot && typeof snapshot === "object" ? Object.keys(snapshot) : [];
    const containersLen = Array.isArray(snapshot?.containers) ? snapshot.containers.length : null;
    const instancesLen = Array.isArray(snapshot?.itemInstances)
      ? snapshot.itemInstances.length
      : Array.isArray(snapshot?.item_instances)
        ? snapshot.item_instances.length
        : null;
    const defsLen = Array.isArray(snapshot?.itemDefs)
      ? snapshot.itemDefs.length
      : Array.isArray(snapshot?.item_defs)
        ? snapshot.item_defs.length
        : null;

    return {
      open,
      snapshotType: snapshot == null ? String(snapshot) : typeof snapshot,
      ok: snapshot?.ok,
      keys: keys.length ? keys.join(", ") : "(none)",
      containers: containersLen == null ? "(missing)" : String(containersLen),
      instances: instancesLen == null ? "(missing)" : String(instancesLen),
      defs: defsLen == null ? "(missing)" : String(defsLen),
    };
  }, [open, snapshot]);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handler = (e) => {
      const k = e.key;
      if (k !== "Escape" && k !== "i" && k !== "I") return;

      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();

      if (splitDraft) {
        setSplitDraft(null);
        return;
      }

      if (contextMenu) {
        setContextMenu(null);
        return;
      }

      if (heldStateActive) {
        onCancelHeldState?.();
        return;
      }

      onClose?.();
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [open, splitDraft, contextMenu, heldStateActive, onCancelHeldState, onClose]);

  useEffect(() => {
    if (!open) return;
    setDragItem(null);
    setContextMenu(null);
    setSplitDraft(null);
    setLocalNotice(null);
    setDismissedNoticeText(null);
  }, [open]);

  const hungerCurrent = Number(selfVitals?.hunger?.current ?? 0);
  const hungerMax = Math.max(0, Number(selfVitals?.hunger?.max ?? 100)) || 100;
  const serverAutoFood = snapshot?.macro?.autoFood ?? null;

  useEffect(() => {
    setMacroHungerThreshold((prev) => {
      const fallback = Math.min(60, hungerMax);
      return Math.min(Math.max(0, Number.isFinite(prev) ? prev : fallback), hungerMax);
    });
  }, [hungerMax]);

  useEffect(() => {
    setMacroFoodItemInstanceId(
      serverAutoFood?.itemInstanceId == null ? null : String(serverAutoFood.itemInstanceId)
    );
    setMacroHungerThreshold((prev) => {
      const next = Number(serverAutoFood?.hungerThreshold ?? Math.min(60, hungerMax));
      if (!Number.isFinite(next)) return prev;
      return Math.min(Math.max(0, next), hungerMax);
    });
  }, [serverAutoFood?.itemInstanceId, serverAutoFood?.hungerThreshold, hungerMax]);

  function getInventoryItemContext(itemInstanceId) {
    if (itemInstanceId == null) return null;
    const inst = inventoryIndex.instanceMap.get(String(itemInstanceId)) ?? null;
    if (!inst) return null;
    const defId = getDefIdFromInstance(inst);
    const def = defId != null ? inventoryIndex.defMap.get(String(defId)) ?? null : null;
    return { inst, def };
  }

  function isFoodItem(itemInstanceId) {
    const ctx = getInventoryItemContext(itemInstanceId);
    return String(ctx?.def?.category ?? "").toUpperCase() === "FOOD";
  }

  useEffect(() => {
    if (!macroFoodItemInstanceId) return;
    if (!isFoodItem(macroFoodItemInstanceId)) {
      setMacroFoodItemInstanceId(null);
    }
  }, [macroFoodItemInstanceId, inventoryIndex]);

  useEffect(() => {
    if (!open) return;

    const handleMove = (event) => {
      setCursorPos({
        x: Number(event.clientX ?? 0),
        y: Number(event.clientY ?? 0),
      });
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("pointermove", handleMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("pointermove", handleMove);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const blockContextMenu = (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
    };

    window.addEventListener("contextmenu", blockContextMenu, { capture: true });
    return () => window.removeEventListener("contextmenu", blockContextMenu, { capture: true });
  }, [open]);

  useEffect(() => {
    if (!splitDraft) return;
    const timer = window.setTimeout(() => splitInputRef.current?.focus?.(), 0);
    return () => window.clearTimeout(timer);
  }, [splitDraft]);

  if (!open) return null;

  const requestCloseInventory = () => {
    if (splitDraft) {
      setSplitDraft(null);
      return;
    }

    if (contextMenu) {
      setContextMenu(null);
      return;
    }

    if (heldStateActive) {
      onCancelHeldState?.();
      return;
    }

    onClose?.();
  };

  const closeFromBackdrop = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    console.log("[INV][SPLIT] backdrop mousedown", {
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    requestCloseInventory();
  };

  const isSlotCompatible = (itemInstanceId, slotCode) => {
    const inst = inventoryIndex.instanceMap.get(String(itemInstanceId));
    if (!inst) return false;

    const defId = getDefIdFromInstance(inst);
    const def = defId != null ? inventoryIndex.defMap.get(String(defId)) : null;
    if (!def) return false;

    const allowedSlots = getAllowedSlotsForDef(def);
    return allowedSlots.includes(String(slotCode));
  };

  const handleDragStart = (itemInstanceId, slotCode, options = {}) => (event) => {
    if (heldStateActive) return;

    const ctx = getInventoryItemContext(itemInstanceId);
    const inst = ctx?.inst ?? null;
    const def = ctx?.def ?? null;
    const allowedSlots = getAllowedSlotsForDef(def);
    const sourceKind =
      options.sourceKind ??
      (equipmentIndex.get(String(slotCode))?.sourceContainerId != null
        ? "legacy-inventory"
        : equipmentIndex.has(String(slotCode))
          ? "equipment"
          : "inventory");

    const payload = {
      itemInstanceId: String(itemInstanceId),
      fromSlotCode: String(slotCode),
      sourceKind,
      sourceContainerId:
        options.sourceContainerId ?? equipmentIndex.get(String(slotCode))?.sourceContainerId ?? null,
      sourceSlotIndex:
        options.sourceSlotIndex ?? equipmentIndex.get(String(slotCode))?.sourceSlotIndex ?? null,
      sourceRole: options.sourceRole ?? equipmentIndex.get(String(slotCode))?.sourceRole ?? String(slotCode),
      allowedSlots,
      itemCategory: def?.category ?? null,
      itemName: getItemLabel(inst, def),
    };

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
    event.dataTransfer?.setData("application/json", JSON.stringify(payload));
    event.dataTransfer?.setData("text/plain", String(itemInstanceId));
    event.dataTransfer?.setDragImage?.(event.currentTarget, 20, 20);
    dropHandledRef.current = false;
    setDragItem(payload);
  };

  const clearDrag = () => {
    setDragItem(null);
  };

  const handleInventoryDropHint = (slotCode) => (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    dropHandledRef.current = true;
    const raw = event.dataTransfer?.getData("application/json");
    if (!raw) return;

    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }

    if (!payload?.itemInstanceId) return;

    const sourceKind = payload.sourceKind || "inventory";
    const allowed = Array.isArray(payload.allowedSlots) ? payload.allowedSlots : [];
    if (sourceKind === "inventory" && !allowed.includes(String(slotCode))) {
      setLocalNotice(`Item not allowed in ${slotCode}`);
      clearDrag();
      return;
    }

    const slot = equipmentIndex.get(String(slotCode)) ?? null;
    const fromContainerId = payload.sourceContainerId ?? null;
    const fromSlotIndex = payload.sourceSlotIndex ?? null;
    const fromRole = payload.sourceRole ?? payload.fromSlotCode ?? null;
    const toContainerId = slot?.sourceContainerId ?? null;
    const toSlotIndex = slot?.sourceSlotIndex ?? null;
    const toRole = slot?.sourceRole ?? slotCode;
    const canLegacyMove =
      sourceKind === "legacy-inventory" &&
      fromRole != null &&
      fromSlotIndex != null &&
      toRole != null &&
      toSlotIndex != null;

    const ok = canLegacyMove
      ? onMoveInventoryItem?.({
          fromRole,
          fromSlotIndex,
          toRole,
          toSlotIndex,
          qty: 1,
        })
      : sourceKind === "equipment"
        ? onSwapEquipmentSlots?.({
            fromSlotCode: payload.fromSlotCode || payload.slotCode || null,
            toSlotCode: slotCode,
          })
        : slot?.itemInstanceId
          ? onSwapEquipmentSlots?.({
              fromSlotCode: payload.fromSlotCode || payload.slotCode || null,
              toSlotCode: slotCode,
            })
          : onEquipItemToSlot?.({
              itemInstanceId: payload.itemInstanceId,
              slotCode,
            });

    if (!ok) {
      setLocalNotice(slot?.itemInstanceId ? "Equipment swap is not available right now" : "Equipment action is not available right now");
    } else {
      setLocalNotice(null);
    }

    clearDrag();
  };

  const handleDropToWorld = () => {
    const pending = dragItem;
    dropHandledRef.current = true;
    clearDrag();

    if (!pending?.itemInstanceId) return;

    const ok = onDropItemToWorld?.(pending.itemInstanceId);
    if (!ok) {
      setLocalNotice("Drop is not available right now");
    } else {
      setLocalNotice(null);
    }
  };

  const handleDragEnd = () => {
    const pending = dragItem;
    clearDrag();

    if (!dropHandledRef.current && pending?.itemInstanceId) {
      const ok = onDropItemToWorld?.(pending.itemInstanceId);
      if (!ok) {
        setLocalNotice("Drop is not available right now");
      } else {
        setLocalNotice(null);
      }
    }

    dropHandledRef.current = false;
  };

  const handleUnequip = (slotCode) => {
    const ok = onUnequipItemFromSlot?.({ slotCode });
    if (!ok) {
      setLocalNotice("Equipment action is not available right now");
      return false;
    }

    setLocalNotice(null);
    return true;
  };

  const handleEquipmentSlotMouseUp = (slot, occupied) => (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault?.();
    event.stopPropagation?.();

    setCursorPos({
      x: Number(event.clientX ?? 0),
      y: Number(event.clientY ?? 0),
    });

    if (dragItem) {
      return;
    }

    if (slot.sourceContainerId == null || slot.sourceSlotIndex == null) {
      return;
    }

    if (heldStateActive) {
      const ok = onPlaceHeldItem?.({
        containerId: slot.sourceContainerId,
        slotIndex: slot.sourceSlotIndex,
      });
      if (!ok) {
        setLocalNotice("Place is not available right now");
      } else {
        setLocalNotice(null);
      }
      return;
    }

    if (!occupied) return;

    const ok = onPickupInventoryItem?.({
      containerId: slot.sourceContainerId,
      slotIndex: slot.sourceSlotIndex,
    });
    if (!ok) {
      setLocalNotice("Pickup is not available right now");
    } else {
      setLocalNotice(null);
    }
  };

  const handleMacroFoodDrop = (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    dropHandledRef.current = true;
    const raw = event.dataTransfer?.getData("application/json");
    if (!raw) return;

    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }

    if (!payload?.itemInstanceId) return;

    if (!isFoodItem(payload.itemInstanceId)) {
      setLocalNotice("Macro accepts only FOOD items");
      clearDrag();
      return;
    }

    const nextItemInstanceId = String(payload.itemInstanceId);
    setMacroFoodItemInstanceId(nextItemInstanceId);
    const ok = onSetAutoFoodMacro?.({
      itemInstanceId: nextItemInstanceId,
      hungerThreshold: macroHungerThreshold,
    });
    if (!ok) {
      setLocalNotice("Macro update is not available right now");
    } else {
      setLocalNotice(null);
    }
    clearDrag();
  };

  const openContextMenu = (slotCtx, event) => {
    event.preventDefault?.();
    event.stopPropagation?.();

    const containerId = slotCtx?.containerId ?? slotCtx?.sourceContainerId ?? null;
    const slotIndex = slotCtx?.slotIndex ?? slotCtx?.sourceSlotIndex ?? null;
    const stackMax = Number(slotCtx?.itemDef?.stackMax ?? slotCtx?.item?.stackMax ?? 1);
    const canSplit = Boolean(stackMax > 1 && Number(slotCtx?.qty ?? 0) > 1);

    console.log("[INV][SPLIT] open context menu", {
      slotCtx: {
        ...slotCtx,
        containerId,
        slotIndex,
      },
      canSplit,
      heldStateActive,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (heldStateActive || !slotCtx?.itemInstanceId) return;

    const maxX = window.innerWidth - 180;
    const maxY = window.innerHeight - 140;

    setContextMenu({
      x: Math.max(12, Math.min(event.clientX, maxX)),
      y: Math.max(12, Math.min(event.clientY, maxY)),
      slot: {
        ...slotCtx,
        containerId,
        slotIndex,
        canSplit,
      },
    });
    setSplitDraft(null);
  };

  const openContextMenuFromMouseDown = (slotCtx, event) => {
    if (event.button !== 2) return false;

    event.preventDefault?.();
    event.stopPropagation?.();

    console.log("[INV][SPLIT] right mousedown fallback", {
      slotCtx,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (heldStateActive || !slotCtx?.itemInstanceId) return true;

    openContextMenu(slotCtx, event);
    return true;
  };

  const openSplitModal = () => {
    if (!contextMenu?.slot) return;

    const slot = contextMenu.slot;
    const qty = Number(slot.qty ?? 0);
    const defaultQty = qty > 2 ? Math.max(1, Math.floor(qty / 2)) : 1;

    console.log("[INV][SPLIT] open split modal", {
      slot,
      qty,
      defaultQty,
    });

    setSplitDraft({
      slot,
      qtyText: String(clampSplitQty(defaultQty, Math.max(1, qty - 1))),
      error: null,
    });
    setContextMenu(null);
  };

  const submitSplit = () => {
    if (!splitDraft?.slot) return;

    const slot = splitDraft.slot;
    const containerId = slot?.containerId ?? slot?.sourceContainerId ?? null;
    const slotIndex = slot?.slotIndex ?? slot?.sourceSlotIndex ?? null;
    const qtyCurrent = Number(slot.qty ?? 0);
    const qty = clampSplitQty(splitDraft.qtyText, Math.max(1, qtyCurrent - 1));

    console.log("[INV][SPLIT] submit split", {
      slot,
      qtyCurrent,
      qtyText: splitDraft.qtyText,
      qty,
    });

    if (!Number.isInteger(qty) || qty < 1 || qty >= qtyCurrent) {
      console.log("[INV][SPLIT] split validation failed", {
        qty,
        qtyCurrent,
      });
      setSplitDraft((prev) => ({
        ...prev,
        error: `Split qty must be between 1 and ${Math.max(1, qtyCurrent - 1)}`,
      }));
      return;
    }

    const ok = onSplitInventoryItem?.({
      containerId,
      slotIndex,
      qty,
    });

    console.log("[INV][SPLIT] emit result", {
      ok,
      containerId,
      slotIndex,
      qty,
    });

    if (!ok) {
      setLocalNotice("Split is not available right now");
      return;
    }

    setSplitDraft(null);
    setLocalNotice(null);
  };

  const containers = snapshot.containers || [];
  const rawNoticeText = inventoryMessage || equipmentMessage || localNotice;
  const equipmentNoticeText = rawNoticeText && rawNoticeText === dismissedNoticeText ? null : rawNoticeText;
  const heldPreviewItem = heldState?.item ?? null;
  const heldPreviewLabel =
    heldPreviewItem?.name || heldPreviewItem?.code || heldState?.itemInstanceId || "Item";
  const heldPreviewQty = Number(heldState?.qty ?? 0);
  const carryWeight = snapshot?.carryWeight ?? null;
  const carryWeightCurrent = Number(carryWeight?.current ?? 0);
  const carryWeightMax = Number(carryWeight?.max ?? 0);
  const carryWeightPct =
    carryWeightMax > 0
      ? Math.min(100, Math.max(0, (carryWeightCurrent / carryWeightMax) * 100))
      : 0;
  const carryWeightTone =
    carryWeightMax > 0
      ? carryWeightPct >= 95
        ? "danger"
        : carryWeightPct >= 75
          ? "warn"
          : "ok"
      : "neutral";
  const selectedMacroFood = macroFoodItemInstanceId ? getInventoryItemContext(macroFoodItemInstanceId) : null;
  const selectedMacroFoodLabel = selectedMacroFood
    ? getItemLabel(selectedMacroFood.inst, selectedMacroFood.def)
    : "Food Item";
  if (!snapshot || !ok) {
    return (
      <div className="inv-backdrop" data-ui-block-game-input="true" onMouseDown={closeFromBackdrop}>
        <div className="inv-modal" data-ui-block-game-input="true" onMouseDown={(e) => e.stopPropagation()}>
          <div className="inv-header">
            <h2>INVENTORY</h2>
            <button onClick={requestCloseInventory}>X</button>
          </div>

          <div className="inv-empty">
            <div className="inv-empty-title">Inventory unavailable.</div>

            <div className="inv-debug">
              <div className="inv-debug-row">
                <span className="inv-debug-k">open</span>
                <span className="inv-debug-v">{String(debug.open)}</span>
              </div>
              <div className="inv-debug-row">
                <span className="inv-debug-k">snapshot</span>
                <span className="inv-debug-v">{debug.snapshotType}</span>
              </div>
              <div className="inv-debug-row">
                <span className="inv-debug-k">ok</span>
                <span className="inv-debug-v">{String(debug.ok)}</span>
              </div>
              <div className="inv-debug-row">
                <span className="inv-debug-k">keys</span>
                <span className="inv-debug-v">{debug.keys}</span>
              </div>
              <div className="inv-debug-row">
                <span className="inv-debug-k">containers</span>
                <span className="inv-debug-v">{debug.containers}</span>
              </div>
              <div className="inv-debug-row">
                <span className="inv-debug-k">instances</span>
                <span className="inv-debug-v">{debug.instances}</span>
              </div>
              <div className="inv-debug-row">
                <span className="inv-debug-k">defs</span>
                <span className="inv-debug-v">{debug.defs}</span>
              </div>
            </div>

            <div className="inv-debug-hint">
              The GameShell should set <code>inventorySnapshot</code> from <code>inv:full</code>.
              Close with <b>Esc</b>/<b>I</b> or click outside.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="inv-backdrop"
      data-ui-block-game-input="true"
      onMouseDown={closeFromBackdrop}
      onContextMenu={(e) => {
        e.preventDefault?.();
        e.stopPropagation?.();
      }}
      onDragOver={(e) => {
        if (dragItem) e.preventDefault?.();
      }}
      onDrop={(e) => {
        if (!dragItem) return;
        e.preventDefault?.();
        e.stopPropagation?.();
        handleDropToWorld();
      }}
    >
      <div
        className="inv-modal inv-modal--equipment"
        data-ui-block-game-input="true"
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault?.();
          e.stopPropagation?.();
        }}
        onDragOver={(e) => {
          if (dragItem) e.preventDefault?.();
        }}
        onDrop={(e) => {
          if (!dragItem) return;
          e.preventDefault?.();
          e.stopPropagation?.();
          handleDropToWorld();
        }}
      >
        <div className="inv-header">
          <h2>INVENTORY</h2>
          <button onClick={requestCloseInventory}>X</button>
        </div>

        <div
          className="inv-body"
          onContextMenu={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
          }}
          onDragOver={(e) => {
            if (dragItem) e.preventDefault?.();
          }}
          onDrop={(e) => {
            if (!dragItem) return;
            e.preventDefault?.();
            e.stopPropagation?.();
            handleDropToWorld();
          }}
        >
          {equipmentNoticeText ? (
            <div className="inv-notice">
              <span className="inv-notice-text">{equipmentNoticeText}</span>
              <button
                type="button"
                className="inv-notice-close"
                onClick={() => {
                  setLocalNotice(null);
                  setDismissedNoticeText(equipmentNoticeText);
                }}
              >
                X
              </button>
            </div>
          ) : null}

          {heldStateActive ? (
            <div
              className="inv-held-preview"
              style={{
                left: `${cursorPos.x + 18}px`,
                top: `${cursorPos.y + 18}px`,
              }}
            >
              <div className="inv-held-preview-kicker">Carrying</div>
              <div className="inv-held-preview-card">
                <div className="inv-held-preview-name">{heldPreviewLabel}</div>
                <div className="inv-held-preview-meta">
                  <span>{heldState.mode}</span>
                  <span>x{heldPreviewQty}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="inv-layout">
            <section className="inv-panel inv-panel--inventory">
              <div className="inv-weight">
                <div className="inv-weight-head">
                  <span className="inv-weight-label">Carry Weight</span>
                  <span className="inv-weight-value">
                    {formatWeight(carryWeightCurrent)} / {formatWeight(carryWeightMax)}
                  </span>
                </div>
                <div className={`inv-weight-track is-${carryWeightTone}`} aria-hidden="true">
                  <div
                    className="inv-weight-fill"
                    style={{
                      width: `${carryWeightPct}%`,
                    }}
                  />
                </div>
              </div>

              <div className="inv-panel-title">Inventory</div>

              {containers.map((container, cIndex) => {
                const role = container?.slotRole ?? container?.role ?? "CONTAINER";
                const slots = container?.slots || [];

                return (
                  <div className="inv-container" key={cIndex}>
                    <div className="inv-container-title">{String(role).toUpperCase()}</div>

                    <div className="inv-grid">
                      {slots.map((slot, sIndex) => {
                        const slotIndex = slot?.slotIndex ?? slot?.slot ?? sIndex;
                        const containerId = container?.id ?? container?.containerId ?? cIndex;
                        const instanceId = slot?.itemInstanceId ?? slot?.item_instance_id ?? null;
                        const qty = Number(slot?.qty ?? 0);

                        let itemName = null;
                        let allowedSlots = [];
                        let itemDef = null;

                        if (instanceId != null) {
                          const inst = inventoryIndex.instanceMap.get(String(instanceId));
                          if (inst) {
                            const defId = getDefIdFromInstance(inst);
                            itemDef = defId != null ? inventoryIndex.defMap.get(String(defId)) : null;
                            itemName = getItemLabel(inst, itemDef);
                            allowedSlots = getAllowedSlotsForDef(itemDef);
                          } else {
                            itemName = `INSTANCE_${instanceId}`;
                          }
                        }

                        const isHeldSource =
                          heldStateActive &&
                          String(heldState.sourceContainerId) === String(containerId) &&
                          Number(heldState.sourceSlotIndex) === Number(slotIndex);

                        return (
                          <div
                            className={[
                              "inv-slot",
                              instanceId ? "is-occupied" : "is-empty",
                              isHeldSource ? "is-held-source" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={`${cIndex}-${sIndex}`}
                            draggable={Boolean(instanceId) && !heldStateActive}
                            onDragStart={
                              instanceId
                                ? handleDragStart(instanceId, `INV:${containerId}:${slotIndex}`, {
                                    sourceKind: "inventory",
                                    sourceContainerId: containerId,
                                    sourceSlotIndex: slotIndex,
                                    sourceRole: role,
                                  })
                                : undefined
                            }
                            onDragEnd={instanceId ? handleDragEnd : undefined}
                            onMouseUp={(event) => {
                              if (event.button != null && event.button !== 0) return;
                              event.preventDefault?.();
                              event.stopPropagation?.();

                              setCursorPos({
                                x: Number(event.clientX ?? 0),
                                y: Number(event.clientY ?? 0),
                              });

                              setContextMenu(null);
                              setSplitDraft(null);

                              if (heldStateActive) {
                                const ok = onPlaceHeldItem?.({
                                  containerId,
                                  slotIndex,
                                });
                                if (!ok) {
                                  setLocalNotice("Place is not available right now");
                                } else {
                                  setLocalNotice(null);
                                }
                                return;
                              }

                              if (!instanceId) return;

                              const ok = onPickupInventoryItem?.({
                                containerId,
                                slotIndex,
                              });
                              if (!ok) {
                                setLocalNotice("Pickup is not available right now");
                              } else {
                                setLocalNotice(null);
                              }
                            }}
                            onMouseDown={(event) => {
                              console.log("[INV][SPLIT] slot mousedown", {
                                button: event.button,
                                containerId,
                                slotIndex,
                                instanceId,
                                clientX: event.clientX,
                                clientY: event.clientY,
                              });

                              if (openContextMenuFromMouseDown(
                                {
                                  containerId,
                                  slotIndex,
                                  itemInstanceId: instanceId,
                                  qty,
                                  itemName,
                                  itemDef,
                                },
                                event
                              )) {
                                return;
                              }

                              event.stopPropagation?.();
                            }}
                            onContextMenu={(event) => {
                              console.log("[INV][SPLIT] slot contextmenu event", {
                                button: event.button,
                                containerId,
                                slotIndex,
                                instanceId,
                                clientX: event.clientX,
                                clientY: event.clientY,
                              });
                              if (!instanceId) {
                                event.preventDefault?.();
                                console.log("[INV][SPLIT] slot context menu on empty slot", {
                                  containerId,
                                  slotIndex,
                                });
                                return;
                              }
                              console.log("[INV][SPLIT] slot context menu", {
                                containerId,
                                slotIndex,
                                instanceId,
                                qty,
                                itemName,
                              });
                              openContextMenu(
                                {
                                  containerId,
                                  slotIndex,
                                  itemInstanceId: instanceId,
                                  qty,
                                  itemName,
                                  itemDef,
                                },
                                event
                              );
                            }}
                          >
                            <div className="inv-slot-index">{String(slotIndex).padStart(2, "0")}</div>

                            {itemName ? (
                              <div className="inv-item-card" draggable={false}>
                                <div className="inv-item-top">
                                  <InventoryItemIcon itemDef={itemDef} label={itemName} className="inv-item-icon" />
                                  <div className="inv-item-name">{itemName}</div>
                                </div>
                                {allowedSlots.length ? (
                                  <div className="inv-item-tags">
                                    {allowedSlots.map((allowed) => (
                                      <span className="inv-tag" key={allowed}>
                                        {allowed}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {qty > 0 && <div className="inv-qty">{qty}</div>}
                              </div>
                            ) : (
                              <div className="inv-empty-slot">EMPTY</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>

            <div className="inv-sidebar">
              <section className="inv-panel inv-panel--hands">
                <div className="inv-panel-title">USAGE</div>
                <div className="equip-list equip-list--hands">
                  {handSlots.map((slot) => {
                    const item = slot.item;
                    const occupied = Boolean(slot.itemInstanceId);
                    const qty = Number(slot.qty ?? 0);
                    const compatible = dragItem
                      ? isSlotCompatible(dragItem.itemInstanceId, slot.slotCode)
                      : false;
                    const canDrag = occupied && !heldStateActive;

                    return (
      <div
                        className={[
                          "equip-slot",
                          occupied ? "is-occupied" : "is-empty",
                          compatible ? "is-drop-ready" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={slot.slotCode}
                        draggable={canDrag}
                        onDragStart={canDrag ? handleDragStart(slot.itemInstanceId, slot.slotCode) : undefined}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => {
                          if (dragItem) e.preventDefault();
                        }}
                        onDrop={handleInventoryDropHint(slot.slotCode)}
                        onMouseUp={handleEquipmentSlotMouseUp(slot, occupied)}
                        onMouseDown={(event) => {
                          console.log("[INV][SPLIT] equip slot mousedown", {
                            button: event.button,
                            slotCode: slot.slotCode,
                            occupied,
                            clientX: event.clientX,
                            clientY: event.clientY,
                          });

                          if (openContextMenuFromMouseDown(slot, event)) {
                            return;
                          }

                          event.stopPropagation?.();
                        }}
                        onContextMenu={(event) => {
                          console.log("[INV][SPLIT] equip slot contextmenu event", {
                            button: event.button,
                            slotCode: slot.slotCode,
                            occupied,
                            clientX: event.clientX,
                            clientY: event.clientY,
                          });
                        }}
                      >
                        <div className="equip-slot-head">
                          <span className="equip-slot-code">{slot.slotCode}</span>
                        </div>

                        <div className="equip-slot-body">
                          {item ? (
                            <div className="equip-slot-details">
                              <div className="equip-item-name">{item.name || item.code || "Equipped item"}</div>
                              {qty > 0 ? <div className="equip-item-qty">x{qty}</div> : null}
                            </div>
                          ) : (
                            <div className="equip-slot-details">
                              <div className="equip-empty">Drop compatible item here</div>
                            </div>
                          )}

                          <div className="equip-slot-icon" aria-hidden="true">
                            {item ? <InventoryItemIcon itemDef={item} label={item.name || item.code || "Item"} /> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="inv-panel inv-panel--equipment">
                <div className="inv-tab-bar" role="tablist" aria-label="Inventory side panels">
                  {SIDEBAR_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeSidebarTab === tab.id}
                      className={[
                        "inv-tab-button",
                        activeSidebarTab === tab.id ? "is-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setActiveSidebarTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeSidebarTab === "equipment" ? (
                  <div className="equip-group equip-group--tabbed">
                    <div className="equip-list">
                      {wearSlotRows.map((row, rowIndex) => (
                        <div
                          className={`equip-row equip-row--${row.length === 1 ? "single" : row.length === 2 ? "double" : "triple"}`}
                          key={`wear-row-${rowIndex}`}
                        >
                          {row.map((slot) => {
                            const item = slot.item;
                            const occupied = Boolean(slot.itemInstanceId);
                            const compatible = dragItem
                              ? isSlotCompatible(dragItem.itemInstanceId, slot.slotCode)
                              : false;
                            const canDrag = occupied && !heldStateActive;

                            return (
                              <div
                                className={[
                                  "equip-slot",
                                  occupied ? "is-occupied" : "is-empty",
                                  compatible ? "is-drop-ready" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                key={slot.slotCode}
                                draggable={canDrag}
                                onDragStart={canDrag ? handleDragStart(slot.itemInstanceId, slot.slotCode) : undefined}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => {
                                  if (dragItem) e.preventDefault();
                                }}
                                onDrop={handleInventoryDropHint(slot.slotCode)}
                                onMouseUp={handleEquipmentSlotMouseUp(slot, occupied)}
                              >
                                <div className="equip-slot-head">
                                  <span className="equip-slot-code">{slot.slotCode}</span>
                                </div>

                                <div className="equip-slot-body">
                                  {item ? (
                                    <>
                                      <div className="equip-slot-details">
                                        <div className="equip-item-name">{item.name || item.code || "Equipped item"}</div>
                                      </div>
                                      <div className="equip-slot-icon" aria-hidden="true">
                                        <InventoryItemIcon itemDef={item} label={item.name || item.code || "Item"} />
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : activeSidebarTab === "macro" ? (
                  <div className="inv-tab-placeholder inv-tab-placeholder--macro">
                    <div className="macro-card">
                      <div
                        className={[
                          "macro-food-slot",
                          selectedMacroFood ? "is-occupied" : "is-empty",
                          dragItem ? (isFoodItem(dragItem.itemInstanceId) ? "is-drop-ready" : "is-drop-blocked") : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onDragOver={(event) => {
                          if (dragItem) event.preventDefault();
                        }}
                        onDrop={handleMacroFoodDrop}
                      >
                        <div className="macro-food-slot-top">
                          <div className="macro-food-slot-body">
                            <InventoryItemIcon
                              itemDef={selectedMacroFood?.def ?? null}
                              label={selectedMacroFoodLabel}
                              className={`macro-food-icon-box ${selectedMacroFood ? "is-filled" : "is-empty"}`}
                            />
                            <div className="macro-food-slot-name">{selectedMacroFoodLabel}</div>
                          </div>

                          {selectedMacroFood ? (
                            <button
                              type="button"
                              className="macro-food-clear"
                              onClick={() => {
                                setMacroFoodItemInstanceId(null);
                                const ok = onSetAutoFoodMacro?.({
                                  itemInstanceId: null,
                                  hungerThreshold: macroHungerThreshold,
                                });
                                if (!ok) {
                                  setLocalNotice("Macro update is not available right now");
                                } else {
                                  setLocalNotice(null);
                                }
                              }}
                            >
                              Clear
                            </button>
                          ) : (
                            <span className="macro-food-empty-state">EMPTY</span>
                          )}
                        </div>

                        <div className="macro-threshold-head">
                          <span className="macro-threshold-label">Trigger Hunger</span>
                          <span className="macro-threshold-value">
                            {macroHungerThreshold} / {hungerMax}
                          </span>
                        </div>

                        <input
                          className="macro-threshold-slider"
                          type="range"
                          min="0"
                          max={String(hungerMax)}
                          step="1"
                          value={macroHungerThreshold}
                          onChange={(event) => {
                            const nextThreshold = Number(event.target.value ?? 0);
                            setMacroHungerThreshold(nextThreshold);
                            const ok = onSetAutoFoodMacro?.({
                              itemInstanceId: macroFoodItemInstanceId,
                              hungerThreshold: nextThreshold,
                            });
                            if (!ok) {
                              setLocalNotice("Macro update is not available right now");
                            } else {
                              setLocalNotice(null);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="inv-tab-placeholder">
                    <div className="inv-tab-placeholder-title">
                      {activeSidebarTab === "craft" ? "Craft" : "Macro"}
                    </div>
                    <div className="inv-tab-placeholder-text">
                      Janela de {activeSidebarTab === "craft" ? "craft" : "macro"} pronta para a proxima etapa.
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      {contextMenu ? (
        <div
          className="inv-context-overlay"
          onMouseDown={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
            if (e.target === e.currentTarget) {
              setContextMenu(null);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
          }}
        >
          <div
            className="inv-context-menu"
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault?.();
              e.stopPropagation?.();
            }}
          >
          {contextMenu.slot?.canSplit ? (
            <button
              type="button"
              className="inv-context-menu-item"
              onClick={() => {
                console.log("[INV][SPLIT] context menu split click", {
                  slot: contextMenu.slot,
                });
                openSplitModal();
              }}
            >
              Split
            </button>
          ) : null}

          <button
            type="button"
            className="inv-context-menu-item"
            onClick={() => {
              const slot = contextMenu.slot;
              setContextMenu(null);
              setSplitDraft(null);
              console.log("[INV][SPLIT] context menu drop click", {
                itemInstanceId: slot?.itemInstanceId ?? null,
                slot,
              });
              const ok = onDropItemToWorld?.(slot.itemInstanceId);
              if (!ok) {
                setLocalNotice("Drop is not available right now");
              } else {
                setLocalNotice(null);
              }
            }}
          >
            Drop
          </button>

          {contextMenu.slot?.slotCode ? (
            <button
              type="button"
              className="inv-context-menu-item"
              onClick={() => {
                const slot = contextMenu.slot;
                setContextMenu(null);
                setSplitDraft(null);
                console.log("[INV][SPLIT] context menu remove click", {
                  slotCode: slot?.slotCode ?? null,
                });
                const ok = handleUnequip(slot?.slotCode);
                if (!ok) {
                  setLocalNotice("Equipment action is not available right now");
                }
              }}
            >
              Remove
            </button>
          ) : null}
          </div>
        </div>
      ) : null}

      {splitDraft ? (
        <div
          className="inv-split-modal"
          onMouseDown={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
            if (e.target === e.currentTarget) {
              setSplitDraft(null);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
          }}
        >
          <div className="inv-split-card">
            <div className="inv-split-title">Split stack</div>
            <div className="inv-split-name">
              {splitDraft.slot?.itemName || splitDraft.slot?.itemInstanceId || "Item"}
            </div>
            <div className="inv-split-qty">Current qty: {Number(splitDraft.slot?.qty ?? 0)}</div>

            <label className="inv-split-label">
              Quantity
              <input
                ref={splitInputRef}
                className="inv-split-input"
                type="number"
                min="1"
                max={Math.max(1, Number(splitDraft.slot?.qty ?? 0) - 1)}
                value={splitDraft.qtyText}
                onChange={(e) =>
                  setSplitDraft((prev) =>
                    prev ? { ...prev, qtyText: e.target.value, error: null } : prev
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSplit();
                  }
                }}
              />
            </label>

            {splitDraft.error ? <div className="inv-split-error">{splitDraft.error}</div> : null}

            <div className="inv-split-actions">
              <button
                type="button"
                className="inv-split-btn"
                onClick={() => {
                  console.log("[INV][SPLIT] split ok button click");
                  submitSplit();
                }}
              >
                OK
              </button>
              <button
                type="button"
                className="inv-split-btn inv-split-btn--ghost"
                onClick={() => {
                  console.log("[INV][SPLIT] split cancel click");
                  setSplitDraft(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
