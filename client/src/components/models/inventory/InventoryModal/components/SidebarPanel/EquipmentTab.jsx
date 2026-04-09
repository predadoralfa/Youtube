import { InventoryItemIcon } from "../../InventoryItemIconBridge";

export function EquipmentTab({
  wearSlotRows,
  dragItem,
  heldStateActive,
  isSlotCompatible,
  handleDragStart,
  handleDragEnd,
  handleInventoryDropHint,
  handleEquipmentSlotMouseUp,
}) {
  return (
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
              const compatible = dragItem ? isSlotCompatible(dragItem.itemInstanceId, slot.slotCode) : false;
              const canDrag = occupied && !heldStateActive;

              return (
                <div
                  className={["equip-slot", occupied ? "is-occupied" : "is-empty", compatible ? "is-drop-ready" : ""].filter(Boolean).join(" ")}
                  key={slot.slotCode}
                  draggable={canDrag}
                  onDragStart={canDrag ? handleDragStart({ itemInstanceId: slot.itemInstanceId, fromSlotCode: slot.slotCode, sourceKind: "equipment" }) : undefined}
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
  );
}
