import { InventoryItemIcon } from "../../InventoryItemIconBridge";

export function MacroTab({
  heldStateActive,
  selectedMacroFood,
  selectedMacroFoodLabel,
  macroFoodItemInstanceId,
  macroHungerThreshold,
  hungerMax,
  setMacroHungerThreshold,
  setMacroFoodItemInstanceId,
  onSetAutoFoodMacro,
  setLocalNotice,
  handleMacroFoodDrop,
  handleMacroFoodHeldSelect,
}) {
  return (
    <div className="inv-tab-placeholder inv-tab-placeholder--macro">
      <div className="macro-card">
        <div
          className={[
            "macro-food-slot",
            selectedMacroFood ? "is-occupied" : "is-empty",
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseUp={(event) => {
            if (!heldStateActive) return;
            if (event.button != null && event.button !== 0) return;
            event.preventDefault?.();
            event.stopPropagation?.();

            handleMacroFoodHeldSelect?.();
          }}
          >
            <div className="macro-food-slot-top">
              <div className="macro-food-slot-body">
                {selectedMacroFood ? (
                  <>
                    <InventoryItemIcon
                      itemDef={selectedMacroFood?.def ?? null}
                      label={selectedMacroFoodLabel}
                      className="macro-food-icon-box is-filled"
                    />
                    <div className="macro-food-slot-name">{selectedMacroFoodLabel}</div>
                  </>
                ) : (
                  <div className="macro-food-icon-box is-empty" aria-hidden="true" />
                )}
              </div>

              {selectedMacroFood ? (
              <button
                type="button"
                className="macro-food-clear"
                onClick={() => {
                  setMacroFoodItemInstanceId(null);
                  const ok = onSetAutoFoodMacro?.({
                    itemInstanceId: null,
                    hungerThreshold: macroHungerThreshold,
                  });
                  if (ok) {
                    setLocalNotice(null);
                  }
                }}
                >
                  Clear
                </button>
            ) : (
              <span className="macro-food-empty-state">EMPTY</span>
            )}
            </div>

          <div className="macro-threshold-head">
            <span className="macro-threshold-label">Trigger Hunger</span>
            <span className="macro-threshold-value">{macroHungerThreshold} / {hungerMax}</span>
          </div>

          <input
            className="macro-threshold-slider"
            type="range"
            min="0"
            max={String(hungerMax)}
            step="1"
            value={macroHungerThreshold}
            onChange={(event) => {
              const nextThreshold = Number(event.target.value ?? 0);
              setMacroHungerThreshold(nextThreshold);
              const ok = onSetAutoFoodMacro?.({
                itemInstanceId: macroFoodItemInstanceId,
                hungerThreshold: nextThreshold,
              });
              if (ok) {
                setLocalNotice(null);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
