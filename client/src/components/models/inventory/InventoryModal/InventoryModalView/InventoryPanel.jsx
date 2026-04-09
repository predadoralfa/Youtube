import { InventoryGridSection } from "../components/InventoryGridSection";

export function InventoryPanel(props) {
  return (
    <section className="inv-panel inv-panel--inventory">
      <div className="inv-weight">
        <div className="inv-weight-head">
          <span className="inv-weight-label">Carry Weight</span>
          <span className="inv-weight-value">{props.carryWeightCurrent} / {props.carryWeightMax}</span>
        </div>
        <div className={`inv-weight-track is-${props.carryWeightTone}`} aria-hidden="true">
          <div className="inv-weight-fill" style={{ width: `${props.carryWeightPct}%` }} />
        </div>
      </div>

      <div className="inv-panel-title">Inventory</div>
      <InventoryGridSection
        containers={props.containers}
        inventoryIndex={props.inventoryIndex}
        heldState={props.heldState}
        heldStateActive={props.heldStateActive}
        dragItem={props.dragItem}
        setCursorPos={props.setCursorPos}
        setContextMenu={props.setContextMenu}
        setSplitDraft={props.setSplitDraft}
        setLocalNotice={props.setLocalNotice}
        handleDragStart={props.handleDragStart}
        handleDragEnd={props.handleDragEnd}
        openContextMenu={props.openContextMenu}
        openContextMenuFromMouseDown={props.openContextMenuFromMouseDown}
        onPickupInventoryItem={props.onPickupInventoryItem}
        onPlaceHeldItem={props.onPlaceHeldItem}
      />
    </section>
  );
}
