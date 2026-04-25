import { InventoryItemIcon } from "../InventoryItemIconBridge";
import {
  formatBasketFamilyLabel,
  getAllowedSlotsForDef,
  getDefIdFromInstance,
  getItemLabel,
  isFoodItem,
} from "../helpers";

export function InventoryGridSection({
  containers,
  inventoryIndex,
  heldState,
  heldStateActive,
  dragItem,
  setCursorPos,
  setContextMenu,
  setSplitDraft,
  setLocalNotice,
  handleDragStart,
  handleDragEnd,
  handleInventorySlotDrop,
  openContextMenu,
  openContextMenuFromMouseDown,
  onPickupInventoryItem,
  onPlaceHeldItem,
  compact = false,
}) {
  function formatContainerTitle(container, role) {
    const name = String(container?.def?.name ?? "").trim();
    if (name) return formatBasketFamilyLabel(name, container?.def?.code);

    const rawRole = String(role ?? "").trim();
    if (!rawRole) return "CONTAINER";

    if (rawRole.startsWith("GRANTED:")) {
      const parts = rawRole.split(":");
      const itemCode = String(parts[1] ?? "").trim();
      if (itemCode) return formatBasketFamilyLabel(itemCode.replace(/_/g, " "), itemCode);
      return "Granted Storage";
    }

    if (rawRole.startsWith("BUILD_MATERIALS:")) {
      return "Build Materials";
    }

    return rawRole.toUpperCase();
  }

  return (
    <>
      {containers.map((container, cIndex) => {
        const role = container?.slotRole ?? container?.role ?? "CONTAINER";
        const slots = container?.slots || [];

        return (
          <div className="inv-container" key={cIndex}>
            <div className="inv-container-title">{formatContainerTitle(container, role)}</div>
            <div className={compact ? "inv-grid inv-grid--compact" : "inv-grid"}>
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
                const canEat =
                  instanceId != null
                    ? Boolean(
                        itemDef?.canEat ||
                          ["FOOD", "CONSUMABLE"].includes(String(itemDef?.category ?? "").toUpperCase()) ||
                          String(itemDef?.code ?? "").toUpperCase().startsWith("FOOD-") ||
                          isFoodItem(inventoryIndex, instanceId)
                      )
                    : false;
                const canMedicate = Boolean(itemDef?.canMedicate);
                const hoverLabel = instanceId != null ? itemName || formatContainerTitle(container, role) : null;

                const isHeldSource =
                  heldStateActive &&
                  String(heldState?.sourceContainerId) === String(containerId) &&
                  Number(heldState?.sourceSlotIndex) === Number(slotIndex);

                return (
                  <div
                    className={[
                      "inv-slot",
                      compact ? "inv-slot--compact" : "",
                      instanceId ? "is-occupied" : "is-empty",
                      dragItem ? "is-drop-ready" : "",
                      isHeldSource ? "is-held-source" : "",
                    ].filter(Boolean).join(" ")}
                    key={`${cIndex}-${sIndex}`}
                    draggable={Boolean(instanceId) && !heldStateActive}
                    title={compact ? hoverLabel : undefined}
                    onDragStart={
                      instanceId
                        ? handleDragStart({
                            itemInstanceId: instanceId,
                            fromSlotCode: `INV:${containerId}:${slotIndex}`,
                            sourceKind: "inventory",
                            sourceContainerId: containerId,
                            sourceSlotIndex: slotIndex,
                            sourceRole: role,
                            allowedSlots,
                            itemCategory: itemDef?.category ?? null,
                            itemName,
                          })
                        : undefined
                    }
                    onDragEnd={instanceId ? handleDragEnd : undefined}
                    onDragOver={(event) => {
                      if (dragItem) event.preventDefault?.();
                    }}
                    onDrop={handleInventorySlotDrop?.({ containerId, slotIndex, role })}
                    onMouseUp={(event) => {
                      if (event.button != null && event.button !== 0) return;
                      event.preventDefault?.();
                      event.stopPropagation?.();
                      setCursorPos({ x: Number(event.clientX ?? 0), y: Number(event.clientY ?? 0) });
                      setContextMenu(null);
                      setSplitDraft(null);

                      if (heldStateActive) {
                        const ok = onPlaceHeldItem?.({ containerId, slotIndex });
                        setLocalNotice(ok ? null : "Place is not available right now");
                        return;
                      }

                      if (!instanceId) return;
                      const ok = onPickupInventoryItem?.({ containerId, slotIndex });
                      setLocalNotice(ok ? null : "Pickup is not available right now");
                    }}
                    onMouseDown={(event) => {
                      if (
                        openContextMenuFromMouseDown(
                          { containerId, slotIndex, itemInstanceId: instanceId, qty, itemName, itemDef, canEat, canMedicate },
                          event
                        )
                      ) {
                        return;
                      }
                      event.stopPropagation?.();
                    }}
                    onContextMenu={(event) => {
                      if (!instanceId) {
                        event.preventDefault?.();
                        return;
                      }
                        openContextMenu(
                          { containerId, slotIndex, itemInstanceId: instanceId, qty, itemName, itemDef, canEat, canMedicate },
                          event
                        );
                      }}
                  >
                      {!compact ? <div className="inv-slot-index">{String(slotIndex).padStart(2, "0")}</div> : null}
                      {itemName ? (
                      <div className={compact ? "inv-item-card inv-item-card--compact" : "inv-item-card"} draggable={false}>
                        <div className="inv-item-top">
                          <InventoryItemIcon itemDef={itemDef} label={itemName} className="inv-item-icon" />
                          {!compact ? <div className="inv-item-name">{itemName}</div> : null}
                        </div>
                        {!compact && allowedSlots.length ? (
                          <div className="inv-item-tags">
                            {allowedSlots.map((allowed) => (
                              <span className="inv-tag" key={allowed}>{allowed}</span>
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
    </>
  );
}
