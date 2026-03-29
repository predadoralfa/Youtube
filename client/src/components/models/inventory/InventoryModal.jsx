import { useEffect, useMemo, useRef, useState } from "react";
import "@/style/inventoryModal.css";

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

const HANDS_SLOT_ORDER = ["HAND_L", "HAND_R"];

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

export function InventoryModal({
  open,
  snapshot,
  equipmentSnapshot,
  inventoryMessage,
  equipmentMessage,
  onClose,
  onEquipItemToSlot,
  onUnequipItemFromSlot,
  onDropItemToWorld,
}) {
  const ok = snapshot?.ok === true;
  const [dragItem, setDragItem] = useState(null);
  const [localNotice, setLocalNotice] = useState(null);
  const dropHandledRef = useRef(false);

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
      };
    });

  const wearSlots = useMemo(() => buildSlotList(WEAR_SLOT_ORDER, "WEAR"), [equipmentIndex]);
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
      if (k === "Escape" || k === "i" || k === "I") {
        e.preventDefault?.();
        e.stopPropagation?.();
        e.stopImmediatePropagation?.();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setDragItem(null);
    setLocalNotice(null);
  }, [open]);

  if (!open) return null;

  const closeFromBackdrop = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    onClose?.();
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

  const handleDragStart = (itemInstanceId, slotCode) => (event) => {
    const inst = inventoryIndex.instanceMap.get(String(itemInstanceId));
    const defId = getDefIdFromInstance(inst);
    const def = defId != null ? inventoryIndex.defMap.get(String(defId)) : null;
    const allowedSlots = getAllowedSlotsForDef(def);

    const payload = {
      itemInstanceId: String(itemInstanceId),
      fromSlotCode: String(slotCode),
      allowedSlots,
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

    const allowed = Array.isArray(payload.allowedSlots) ? payload.allowedSlots : [];
    if (!allowed.includes(String(slotCode))) {
      setLocalNotice(`Item not allowed in ${slotCode}`);
      clearDrag();
      return;
    }

    const slot = equipmentIndex.get(String(slotCode)) ?? null;
    if (slot?.itemInstanceId) {
      setLocalNotice(`Slot ${slotCode} is occupied`);
      clearDrag();
      return;
    }

    const ok = onEquipItemToSlot?.({
      itemInstanceId: payload.itemInstanceId,
      slotCode,
    });

    if (!ok) {
      setLocalNotice("Equipment action is not available right now");
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

  const handleUnequip = (slotCode) => () => {
    const ok = onUnequipItemFromSlot?.({ slotCode });
    if (!ok) {
      setLocalNotice("Equipment action is not available right now");
      return;
    }

    setLocalNotice(null);
  };

  if (!snapshot || !ok) {
    return (
      <div className="inv-backdrop" onMouseDown={closeFromBackdrop}>
        <div className="inv-modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="inv-header">
            <h2>INVENTORY</h2>
            <button onClick={() => onClose?.()}>X</button>
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

  const containers = snapshot.containers || [];
  const equipmentNoticeText = inventoryMessage || equipmentMessage || localNotice;

  return (
    <div
      className="inv-backdrop"
      onMouseDown={closeFromBackdrop}
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
        onMouseDown={(e) => e.stopPropagation()}
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
          <button onClick={() => onClose?.()}>X</button>
        </div>

        <div
          className="inv-body"
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
          {equipmentNoticeText ? <div className="inv-notice">{equipmentNoticeText}</div> : null}

          <div className="inv-layout">
            <section className="inv-panel inv-panel--inventory">
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
                        const instanceId = slot?.itemInstanceId ?? slot?.item_instance_id ?? null;
                        const qty = Number(slot?.qty ?? 0);

                        let itemName = null;
                        let allowedSlots = [];

                        if (instanceId != null) {
                          const inst = inventoryIndex.instanceMap.get(String(instanceId));
                          if (inst) {
                            const defId = getDefIdFromInstance(inst);
                            const def = defId != null ? inventoryIndex.defMap.get(String(defId)) : null;
                            itemName = getItemLabel(inst, def);
                            allowedSlots = getAllowedSlotsForDef(def);
                          } else {
                            itemName = `INSTANCE_${instanceId}`;
                          }
                        }

                        const canDrag = Boolean(instanceId);

                        return (
                          <div
                            className={[
                              "inv-slot",
                              canDrag ? "is-occupied" : "is-empty",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={`${cIndex}-${sIndex}`}
                            draggable={canDrag}
                            onDragStart={canDrag ? handleDragStart(instanceId, slotIndex) : undefined}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="inv-slot-index">{String(slotIndex).padStart(2, "0")}</div>

                            {itemName ? (
                              <div className="inv-item-card">
                                <div className="inv-item-name">{itemName}</div>
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
                        draggable={occupied}
                        onDragStart={occupied ? handleDragStart(slot.itemInstanceId, slot.slotCode) : undefined}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => {
                          if (dragItem && !occupied) e.preventDefault();
                        }}
                        onDrop={handleInventoryDropHint(slot.slotCode)}
                      >
                        <div className="equip-slot-head">
                          <span className="equip-slot-code">{slot.slotCode}</span>
                        </div>

                        <div className="equip-slot-body">
                          {item ? (
                            <div className="equip-slot-details">
                              <div className="equip-item-name">{item.name || item.code || "Equipped item"}</div>
                              {qty > 0 ? <div className="equip-item-qty">x{qty}</div> : null}
                              <button className="equip-unequip" onClick={handleUnequip(slot.slotCode)}>
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div className="equip-slot-details">
                              <div className="equip-empty">Drop compatible item here</div>
                            </div>
                          )}

                          <div className="equip-slot-icon" aria-hidden="true" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="inv-panel inv-panel--equipment">
                <div className="inv-panel-title">Equipment</div>

                <div className="equip-group">
                  <div className="equip-list">
                    {wearSlots.map((slot) => {
                      const item = slot.item;
                      const occupied = Boolean(slot.itemInstanceId);
                      const compatible = dragItem
                        ? isSlotCompatible(dragItem.itemInstanceId, slot.slotCode)
                        : false;

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
                          draggable={occupied}
                          onDragStart={occupied ? handleDragStart(slot.itemInstanceId, slot.slotCode) : undefined}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => {
                            if (dragItem && !occupied) e.preventDefault();
                          }}
                          onDrop={handleInventoryDropHint(slot.slotCode)}
                        >
                          <div className="equip-slot-head">
                            <span className="equip-slot-code">{slot.slotCode}</span>
                          </div>

                          <div className="equip-slot-body">
                            {item ? (
                              <>
                                <div className="equip-item-name">{item.name || item.code || "Equipped item"}</div>
                                <button className="equip-unequip" onClick={handleUnequip(slot.slotCode)}>
                                  Remove
                                </button>
                              </>
                            ) : (
                              <div className="equip-empty">Drop compatible item here</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
