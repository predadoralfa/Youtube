import { useEffect, useMemo } from "react";
import "@/style/inventoryModal.css";

/**
 * InventoryModal (read-only)
 * - Backend é fonte da verdade
 * - Modal apenas apresenta snapshot autoritativo recebido (via GameShell)
 *
 * Props (ALINHADO AO GameShell atual):
 * - open: boolean
 * - snapshot: inventoryFullPayload | null
 * - onClose: () => void
 *
 * Importante:
 * - NÃO usa HTTP
 * - NÃO emite socket events
 * - GameShell é o dono do socket e decide quando pedir inv:request_full
 */
export function InventoryModal({ open, snapshot, onClose }) {
  const ok = snapshot?.ok === true;

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

  // trava scroll do body enquanto aberto
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Fecha com ESC e com I no CAPTURE PHASE (antes do input system do jogo)
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

  if (!open) return null;

  const closeFromBackdrop = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    onClose?.();
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
            <div className="inv-empty-title">Inventário indisponível.</div>

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
              O GameShell deve setar <code>inventorySnapshot</code> a partir de <code>inv:full</code>.
              Feche com <b>Esc</b>/<b>I</b> ou clique fora.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ======== RENDER REAL (somente campos confirmados no probe) ========
  const containers = snapshot.containers || [];
  const instances = snapshot.itemInstances || snapshot.item_instances || [];
  const defs = snapshot.itemDefs || snapshot.item_defs || [];

  const instanceMap = new Map();
  for (const inst of instances) {
    const id = inst?.id ?? inst?.instance_id ?? inst?.itemInstanceId;
    if (id != null) instanceMap.set(String(id), inst);
  }

  const defMap = new Map();
  for (const d of defs) {
    const id = d?.id ?? d?.def_id;
    if (id != null) defMap.set(String(id), d);
  }

  return (
    <div className="inv-backdrop" onMouseDown={closeFromBackdrop}>
      <div className="inv-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="inv-header">
          <h2>INVENTORY</h2>
          <button onClick={() => onClose?.()}>X</button>
        </div>

        <div className="inv-body">
          <div className="inv-meta">
            <span className="inv-chip">containers: {containers.length}</span>
            <span className="inv-chip">instances: {instances.length}</span>
            <span className="inv-chip">defs: {defs.length}</span>
          </div>

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

                    if (instanceId != null) {
                      const inst = instanceMap.get(String(instanceId));
                      if (inst) {
                        const defId = inst?.item_def_id ?? inst?.def_id ?? inst?.itemDefId ?? null;
                        const def = defId != null ? defMap.get(String(defId)) : null;
                        itemName = def?.name ?? def?.code ?? (defId != null ? `DEF_${defId}` : "DEF_?");
                      } else {
                        itemName = `INSTANCE_${instanceId}`;
                      }
                    }

                    return (
                      <div className="inv-slot" key={sIndex}>
                        <div className="inv-slot-index">{String(slotIndex).padStart(2, "0")}</div>

                        {itemName ? (
                          <>
                            <div className="inv-item-name">{itemName}</div>
                            {qty > 0 && <div className="inv-qty">{qty}</div>}
                          </>
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
        </div>
      </div>
    </div>
  );
}