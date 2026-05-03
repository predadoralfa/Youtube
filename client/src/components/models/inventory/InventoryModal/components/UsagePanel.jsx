import { InventoryItemIcon } from "../InventoryItemIconBridge";
import { hasContainerItemsById } from "../helpers";

export function UsagePanel({
  containers,
  handSlots,
  heldStateActive,
  handleEquipmentSlotMouseUp,
  openContextMenuFromMouseDown,
  setLocalNotice,
}) {
  const blockedMoveMessage = "A cesta tem itens dentro e nao pode ser movida.";

  return (
    <section className="inv-panel inv-panel--hands">
      <div className="inv-panel-title">USAGE</div>
      <div className="equip-list equip-list--hands">
        {handSlots.map((slot) => {
          const item = slot.item;
          const occupied = Boolean(slot.itemInstanceId);
          const qty = Number(slot.qty ?? 0);
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
                if (openContextMenuFromMouseDown(slot, event)) return;
                event.stopPropagation?.();
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
  );
}
