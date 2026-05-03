import { InventoryGridSection } from "../components/InventoryGridSection";

function normalizeKeyPart(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function hasGrantedContainerComponent(def) {
  const code = String(def?.code ?? "").trim().toUpperCase();
  if (code === "BASKET" || code.startsWith("BASKET_")) return true;

  const components = Array.isArray(def?.components) ? def.components : [];
  return components.some((component) => {
    const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
    return type === "GRANTS_CONTAINER";
  });
}

function getGrantedContainerRole(itemCode, slotCode) {
  const itemCodeValue = normalizeKeyPart(itemCode ?? "");
  const handCode = normalizeKeyPart(slotCode ?? "");
  if (!itemCodeValue || !handCode) return null;
  return `GRANTED:${itemCodeValue}:${handCode}`;
}

function getGrantedContainerKey(container) {
  const role = String(container?.slotRole ?? container?.role ?? "").trim().toUpperCase();
  if (role) return role;
  const id = container?.id ?? container?.containerId ?? null;
  return id != null ? String(id) : null;
}

function readStrictPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function readComponentData(component) {
  const data = component?.dataJson ?? component?.data_json ?? null;
  if (data == null || typeof data !== "string") return data;
  const raw = data.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return data;
  }
}

function getBasketFamilySlotCount(itemDef) {
  const code = String(itemDef?.code ?? "").trim().toUpperCase();
  if (code === "BASKET" || code === "BASKET_T2") return 1;
  if (code === "BASKET_T3" || code === "BASKET_T4") return 2;
  return null;
}

function getGrantedContainerSlotCountStrict({ itemDef, slot, matchingInventoryContainer }) {
  const fromContainerDef = readStrictPositiveInt(
    matchingInventoryContainer?.def?.slotCount ?? matchingInventoryContainer?.def?.slot_count ?? null
  );
  const fromContainerSlots = Array.isArray(matchingInventoryContainer?.slots)
    ? readStrictPositiveInt(matchingInventoryContainer.slots.length)
    : null;
  const fromEquipmentPayload = readStrictPositiveInt(slot?.grantedContainerSlotCount ?? null);
  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  const grantsComponent = components.find((component) => {
    const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
    return type === "GRANTS_CONTAINER";
  });
  const fromItemDef = readStrictPositiveInt(
    readComponentData(grantsComponent)?.slotCount ??
      readComponentData(grantsComponent)?.slot_count ??
      readComponentData(grantsComponent)?.containerSlotCount ??
      readComponentData(grantsComponent)?.container_slot_count ??
      null
  );

  const resolved =
    fromContainerDef ??
    fromContainerSlots ??
    fromEquipmentPayload ??
    fromItemDef ??
    getBasketFamilySlotCount(itemDef) ??
    1;

  if (fromContainerDef != null && fromContainerSlots != null && fromContainerDef !== fromContainerSlots) {
    throw new Error(
      `GRANTED_CONTAINER_SLOTCOUNT_MISMATCH:${String(itemDef?.code ?? "UNKNOWN")}:${String(
        matchingInventoryContainer?.slotRole ?? ""
      )}:${fromContainerDef}:${fromContainerSlots}`
    );
  }

  if (fromEquipmentPayload != null && fromContainerDef != null && fromEquipmentPayload !== fromContainerDef) {
    throw new Error(
      `GRANTED_CONTAINER_SLOTCOUNT_MISMATCH:${String(itemDef?.code ?? "UNKNOWN")}:${String(
        slot?.slotCode ?? slot?.sourceRole ?? ""
      )}:${fromEquipmentPayload}:${fromContainerDef}`
    );
  }

  if (fromEquipmentPayload != null && fromContainerSlots != null && fromEquipmentPayload !== fromContainerSlots) {
    throw new Error(
      `GRANTED_CONTAINER_SLOTCOUNT_MISMATCH:${String(itemDef?.code ?? "UNKNOWN")}:${String(
        slot?.slotCode ?? slot?.sourceRole ?? ""
      )}:${fromEquipmentPayload}:${fromContainerSlots}`
    );
  }

  if (fromItemDef != null && fromEquipmentPayload != null && fromItemDef !== fromEquipmentPayload) {
    throw new Error(
      `GRANTED_CONTAINER_SLOTCOUNT_MISMATCH:${String(itemDef?.code ?? "UNKNOWN")}:${String(
        slot?.slotCode ?? slot?.sourceRole ?? ""
      )}:${fromItemDef}:${fromEquipmentPayload}`
    );
  }

  if (fromItemDef != null && fromContainerDef != null && fromItemDef !== fromContainerDef) {
    throw new Error(
      `GRANTED_CONTAINER_SLOTCOUNT_MISMATCH:${String(itemDef?.code ?? "UNKNOWN")}:${String(
        slot?.slotCode ?? slot?.sourceRole ?? ""
      )}:${fromItemDef}:${fromContainerDef}`
    );
  }

  return resolved;
}

export function InventoryPanel(props) {
  const containers = Array.isArray(props.containers) ? props.containers : [];
  const containersByRole = new Map(
    containers
      .map((container) => [String(container?.slotRole ?? "").trim().toUpperCase(), container])
      .filter(([role]) => Boolean(role))
  );
  const containersById = new Map(
    containers
      .map((container) => [String(container?.id ?? container?.containerId ?? "").trim(), container])
      .filter(([id]) => Boolean(id))
  );
  const inventoryContainers = containers.filter(
    (container) => !String(container?.slotRole ?? "").startsWith("GRANTED:")
  );
  const equipmentSlots = Array.isArray(props.equipmentSnapshot?.slots) ? props.equipmentSnapshot.slots : [];
  const expectedGrantedRoles = new Set();
  const grantedFromEquipment = [];
  for (const slot of equipmentSlots) {
    const itemDefId = slot?.itemDefId ?? slot?.item_def_id ?? slot?.item?.itemDefId ?? slot?.item?.item_def_id ?? null;
    const itemDef = itemDefId == null ? null : props.inventoryIndex?.defMap?.get(String(itemDefId)) ?? null;
    const equippedItemCode = itemDef?.code ?? slot?.item?.code ?? null;
    if (!hasGrantedContainerComponent(itemDef) && !hasGrantedContainerComponent(slot?.item ?? null)) continue;

    const role =
      getGrantedContainerRole(equippedItemCode, slot?.slotCode ?? slot?.sourceRole ?? slot?.source_role ?? null) ||
      String(slot?.sourceRole ?? slot?.slotCode ?? slot?.source_role ?? "").trim();
    const normalizedRole = String(role ?? "").trim().toUpperCase();
    if (!normalizedRole) continue;
    expectedGrantedRoles.add(normalizedRole);
    if (
      containers.some(
        (container) => String(container?.slotRole ?? "").trim().toUpperCase() === normalizedRole
      )
    ) continue;

    const matchingInventoryContainer =
      containersById.get(String(slot?.grantedContainerId ?? "").trim()) ??
      containersByRole.get(normalizedRole) ??
      null;

    const grantedSlotCount = getGrantedContainerSlotCountStrict({
      itemDef,
      slot,
      matchingInventoryContainer,
    });
    const grantedContainer =
      matchingInventoryContainer ?? {
        id: slot?.grantedContainerId ?? role,
        slotRole: role,
        state: "ACTIVE",
        rev: 1,
        def: {
          id: `synthetic:${String(itemDefId ?? equippedItemCode ?? role)}`,
          code: itemDef?.code ?? slot?.item?.code ?? null,
          name: itemDef?.name ?? slot?.item?.name ?? itemDef?.code ?? slot?.item?.code ?? role,
          slotCount: grantedSlotCount,
          maxWeight: 0,
          allowedCategoriesMask: null,
        },
        slots: Array.from({ length: grantedSlotCount }, (_, slotIndex) => ({
          slotIndex,
          itemInstanceId: null,
          qty: 0,
        })),
      };

    if (!matchingInventoryContainer) {
      grantedFromEquipment.push(grantedContainer);
      continue;
    }
  }
  const grantedFromInventory = containers.filter((container) => {
    const role = String(container?.slotRole ?? "").trim().toUpperCase();
    return role.startsWith("GRANTED:") && expectedGrantedRoles.has(role);
  });

  const grantedContainerMap = new Map();
  for (const container of [...grantedFromInventory, ...grantedFromEquipment]) {
    const key = getGrantedContainerKey(container);
    if (!key || grantedContainerMap.has(key)) continue;
    grantedContainerMap.set(key, container);
  }
  const grantedContainers = [...grantedContainerMap.values()];

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
