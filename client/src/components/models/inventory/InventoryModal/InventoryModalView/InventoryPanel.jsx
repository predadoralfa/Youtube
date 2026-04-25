import { InventoryGridSection } from "../components/InventoryGridSection";
import { formatBasketFamilyLabel } from "../helpers";

function normalizeKeyPart(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function shortenGrantedRoleLabel(role) {
  const raw = String(role ?? "").trim();
  if (!raw.startsWith("GRANTED:")) return raw;

  const parts = raw.split(":");
  const itemCode = String(parts[1] ?? "").trim();
  if (!itemCode) return "Storage";

  const basketMatch = itemCode.match(/^BASKET(?:_T(\d+))?$/i);
  if (!basketMatch) {
    return itemCode.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const tier = basketMatch[1];
  return tier ? `Basket T${tier}` : "Basket";
}

function hasGrantedContainerComponent(def) {
  const code = String(def?.code ?? "").trim().toUpperCase();
  if (code === "BASKET") return true;

  const components = Array.isArray(def?.components) ? def.components : [];
  return components.some((component) => {
    const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
    return type === "GRANTS_CONTAINER";
  });
}

function getGrantedContainerRole(itemDef, slotCode) {
  const itemCode = normalizeKeyPart(itemDef?.code ?? "");
  const handCode = normalizeKeyPart(slotCode ?? "");
  if (!itemCode || !handCode) return null;
  return `GRANTED:${itemCode}:${handCode}`;
}

function normalizeRoleLabel(role) {
  const raw = String(role ?? "").trim();
  if (!raw) return "CONTAINER";
  if (raw.startsWith("GRANTED:")) {
    return shortenGrantedRoleLabel(raw);
  }
  return raw.toUpperCase();
}

export function InventoryPanel(props) {
  const containers = Array.isArray(props.containers) ? props.containers : [];
  const inventoryContainers = containers.filter(
    (container) => !String(container?.slotRole ?? "").startsWith("GRANTED:")
  );
  const grantedFromInventory = containers.filter((container) =>
    String(container?.slotRole ?? "").startsWith("GRANTED:")
  );

  const grantedFromEquipment = [];
  const equipmentSlots = Array.isArray(props.equipmentSnapshot?.slots) ? props.equipmentSnapshot.slots : [];
  for (const slot of equipmentSlots) {
    const itemDefId = slot?.itemDefId ?? slot?.item_def_id ?? slot?.item?.itemDefId ?? slot?.item?.item_def_id ?? null;
    const itemDef = itemDefId == null ? null : props.inventoryIndex?.defMap?.get(String(itemDefId)) ?? null;
    if (!hasGrantedContainerComponent(itemDef)) continue;

    const role =
      getGrantedContainerRole(itemDef, slot?.slotCode ?? slot?.sourceRole ?? slot?.source_role ?? null) ||
      String(slot?.sourceRole ?? slot?.slotCode ?? slot?.source_role ?? "").trim();
    if (grantedFromInventory.some((container) => String(container?.slotRole ?? "") === role)) continue;

    grantedFromEquipment.push({
      id: role,
      slotRole: role,
      state: "ACTIVE",
      rev: 1,
        def: {
          id: `synthetic:${itemDefId}`,
          code: itemDef?.code ?? null,
          name: formatBasketFamilyLabel(itemDef?.name ?? itemDef?.code ?? normalizeRoleLabel(role), itemDef?.code),
          slotCount: 1,
          maxWeight: 0,
          allowedCategoriesMask: null,
        },
      slots: [
        {
          slotIndex: 0,
          itemInstanceId: null,
          qty: 0,
        },
      ],
    });
  }

  const grantedContainers = [...grantedFromInventory, ...grantedFromEquipment];

  return (
    <section className="inv-panel inv-panel--inventory">
      <div className="inv-weight-panel inv-panel">
        <div className="inv-weight">
          <div className="inv-weight-head">
            <span className="inv-weight-label">Carry Weight</span>
            <span className="inv-weight-value">
              {props.carryWeightCurrent} / {props.carryWeightMax}
            </span>
          </div>
          <div className={`inv-weight-track is-${props.carryWeightTone}`} aria-hidden="true">
            <div className="inv-weight-fill" style={{ width: `${props.carryWeightPct}%` }} />
          </div>
        </div>
      </div>

      <div className="inv-storage-panel inv-panel">
        <div className="inv-panel-title">Inventory</div>
        <InventoryGridSection
          containers={inventoryContainers}
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
          handleInventorySlotDrop={props.handleInventorySlotDrop}
          openContextMenu={props.openContextMenu}
          openContextMenuFromMouseDown={props.openContextMenuFromMouseDown}
          onPickupInventoryItem={props.onPickupInventoryItem}
          onPlaceHeldItem={props.onPlaceHeldItem}
        />

        {grantedContainers.length ? (
          <div className="inv-granted-section">
            <div className="inv-panel-title">Equipped Containers</div>
            <div className="inv-granted-grid">
              <InventoryGridSection
                containers={grantedContainers}
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
                handleInventorySlotDrop={props.handleInventorySlotDrop}
                openContextMenu={props.openContextMenu}
                openContextMenuFromMouseDown={props.openContextMenuFromMouseDown}
                onPickupInventoryItem={props.onPickupInventoryItem}
                onPlaceHeldItem={props.onPlaceHeldItem}
                compact
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
