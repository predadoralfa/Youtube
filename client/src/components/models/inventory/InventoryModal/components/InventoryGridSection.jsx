import { InventoryItemIcon } from "../InventoryItemIconBridge";
import { getAllowedSlotsForDef, getDefIdFromInstance, getItemLabel, isFoodItem } from "../helpers";

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
  openContextMenu,
  openContextMenuFromMouseDown,
  onPickupInventoryItem,
  onPlaceHeldItem,
}) {
  return (
    <>
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
                const canEat =
                  instanceId != null
                    ? Boolean(
                        itemDef?.canEat ||
                          ["FOOD", "CONSUMABLE"].includes(String(itemDef?.category ?? "").toUpperCase()) ||
                          String(itemDef?.code ?? "").toUpperCase().startsWith("FOOD-") ||
                          isFoodItem(inventoryIndex, instanceId)
                      )
                    : false;

                const isHeldSource =
                  heldStateActive &&
                  String(heldState?.sourceContainerId) === String(containerId) &&
                  Number(heldState?.sourceSlotIndex) === Number(slotIndex);

                return (
                  <div
                    className={["inv-slot", instanceId ? "is-occupied" : "is-empty", isHeldSource ? "is-held-source" : ""].filter(Boolean).join(" ")}
                    key={`${cIndex}-${sIndex}`}
                    draggable={Boolean(instanceId) && !heldStateActive}
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
                          { containerId, slotIndex, itemInstanceId: instanceId, qty, itemName, itemDef, canEat },
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
                        { containerId, slotIndex, itemInstanceId: instanceId, qty, itemName, itemDef, canEat },
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
