export function InventoryOverlays({
  heldStateActive,
  cursorPos,
  heldPreviewLabel,
  heldPreviewQty,
  heldState,
  contextMenu,
  setContextMenu,
  splitDraft,
  setSplitDraft,
  splitInputRef,
  submitSplit,
  openSplitModal,
  handleContextEat,
  handleContextDrop,
  handleContextRemove,
}) {
  const slot = contextMenu?.slot ?? null;
  const slotItem = slot?.itemDef ?? slot?.item ?? null;
  const canEatSlot = Boolean(
    slot?.canEat ||
      slotItem?.canEat ||
      ["FOOD", "CONSUMABLE"].includes(String(slotItem?.category ?? "").toUpperCase()) ||
      String(slotItem?.code ?? "").toUpperCase().startsWith("FOOD-")
  );

  return (
    <>
      {heldStateActive ? (
        <div className="inv-held-preview" style={{ left: `${cursorPos.x + 18}px`, top: `${cursorPos.y + 18}px` }}>
          <div className="inv-held-preview-kicker">Carrying</div>
          <div className="inv-held-preview-card">
            <div className="inv-held-preview-name">{heldPreviewLabel}</div>
            <div className="inv-held-preview-meta">
              <span>{heldState?.mode}</span>
              <span>x{heldPreviewQty}</span>
            </div>
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          className="inv-context-overlay"
          onMouseDown={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
            if (e.target === e.currentTarget) setContextMenu(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
          }}
        >
          <div
            className="inv-context-menu"
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault?.();
              e.stopPropagation?.();
            }}
          >
            {canEatSlot ? (
              <button type="button" className="inv-context-menu-item inv-context-menu-item--accent" onClick={handleContextEat}>
                Eat
              </button>
            ) : null}
            {contextMenu.slot?.canSplit ? (
              <button type="button" className="inv-context-menu-item" onClick={openSplitModal}>
                Split
              </button>
            ) : null}
            <button type="button" className="inv-context-menu-item" onClick={handleContextDrop}>
              Drop
            </button>
            {contextMenu.slot?.slotCode ? (
              <button type="button" className="inv-context-menu-item" onClick={handleContextRemove}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {splitDraft ? (
        <div
          className="inv-split-modal"
          onMouseDown={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
            if (e.target === e.currentTarget) setSplitDraft(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
          }}
        >
          <div className="inv-split-card">
            <div className="inv-split-title">Split stack</div>
            <div className="inv-split-name">{splitDraft.slot?.itemName || splitDraft.slot?.itemInstanceId || "Item"}</div>
            <div className="inv-split-qty">Current qty: {Number(splitDraft.slot?.qty ?? 0)}</div>
            <label className="inv-split-label">
              Quantity
              <input
                ref={splitInputRef}
                className="inv-split-input"
                type="number"
                min="1"
                max={Math.max(1, Number(splitDraft.slot?.qty ?? 0) - 1)}
                value={splitDraft.qtyText}
                onChange={(e) =>
                  setSplitDraft((prev) => (prev ? { ...prev, qtyText: e.target.value, error: null } : prev))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSplit();
                  }
                }}
              />
            </label>
            {splitDraft.error ? <div className="inv-split-error">{splitDraft.error}</div> : null}
            <div className="inv-split-actions">
              <button type="button" className="inv-split-btn" onClick={submitSplit}>OK</button>
              <button type="button" className="inv-split-btn inv-split-btn--ghost" onClick={() => setSplitDraft(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
