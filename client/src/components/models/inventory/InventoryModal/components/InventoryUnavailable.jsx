export function InventoryUnavailable({ debug, onClose, onBackdropClose }) {
  return (
    <div className="inv-backdrop" data-ui-block-game-input="true" onMouseDown={onBackdropClose}>
      <div className="inv-modal" data-ui-block-game-input="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="inv-header">
          <h2>INVENTORY</h2>
          <button onClick={onClose}>X</button>
        </div>

        <div className="inv-empty">
          <div className="inv-empty-title">Inventory unavailable.</div>
          <div className="inv-debug">
            <div className="inv-debug-row"><span className="inv-debug-k">open</span><span className="inv-debug-v">{String(debug.open)}</span></div>
            <div className="inv-debug-row"><span className="inv-debug-k">snapshot</span><span className="inv-debug-v">{debug.snapshotType}</span></div>
            <div className="inv-debug-row"><span className="inv-debug-k">ok</span><span className="inv-debug-v">{String(debug.ok)}</span></div>
            <div className="inv-debug-row"><span className="inv-debug-k">keys</span><span className="inv-debug-v">{debug.keys}</span></div>
            <div className="inv-debug-row"><span className="inv-debug-k">containers</span><span className="inv-debug-v">{debug.containers}</span></div>
            <div className="inv-debug-row"><span className="inv-debug-k">instances</span><span className="inv-debug-v">{debug.instances}</span></div>
            <div className="inv-debug-row"><span className="inv-debug-k">defs</span><span className="inv-debug-v">{debug.defs}</span></div>
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
