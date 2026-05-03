import { InventoryItemIcon } from "../../InventoryItemIconBridge";
import { hasContainerItemsById } from "../../helpers";

export function EquipmentTab({
  containers,
  wearSlotRows,
  heldStateActive,
  handleEquipmentSlotMouseUp,
  setLocalNotice,
}) {
  const blockedMoveMessage = "A cesta tem itens dentro e nao pode ser movida.";

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
              const lockedByGrantedContainer =
                occupied && Boolean(slot.grantedContainerId) && hasContainerItemsById(containers, slot.grantedContainerId);

              const handleMouseUp = (event) => {
                if (lockedByGrantedContainer) {
                  event.preventDefault?.();
                  event.stopPropagation?.();
                  setLocalNotice?.(blockedMoveMessage);
                  return;
                }
                handleEquipmentSlotMouseUp(slot, occupied)(event);
              };

              return (
                <div
                  className={["equip-slot", occupied ? "is-occupied" : "is-empty"].filter(Boolean).join(" ")}
                  key={slot.slotCode}
                  onMouseUp={handleMouseUp}
                  onMouseDown={(event) => {
                    if (lockedByGrantedContainer) {
                      event.preventDefault?.();
                      event.stopPropagation?.();
                      setLocalNotice?.(blockedMoveMessage);
                      return;
                    }
                    event.stopPropagation?.();
                  }}
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
