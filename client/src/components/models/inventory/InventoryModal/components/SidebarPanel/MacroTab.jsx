import { InventoryItemIcon } from "../../InventoryItemIconBridge";

export function MacroTab({
  dragItem,
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
}) {
  return (
    <div className="inv-tab-placeholder inv-tab-placeholder--macro">
      <div className="macro-card">
        <div
          className={["macro-food-slot", selectedMacroFood ? "is-occupied" : "is-empty", dragItem ? "is-drop-ready" : ""].filter(Boolean).join(" ")}
          onDragOver={(event) => {
            if (dragItem) event.preventDefault();
          }}
          onDrop={handleMacroFoodDrop}
        >
          <div className="macro-food-slot-top">
            <div className="macro-food-slot-body">
              <InventoryItemIcon
                itemDef={selectedMacroFood?.def ?? null}
                label={selectedMacroFoodLabel}
                className={`macro-food-icon-box ${selectedMacroFood ? "is-filled" : "is-empty"}`}
              />
              <div className="macro-food-slot-name">{selectedMacroFoodLabel}</div>
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
                  setLocalNotice(ok ? null : "Macro update is not available right now");
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
              setLocalNotice(ok ? null : "Macro update is not available right now");
            }}
          />
        </div>
      </div>
    </div>
  );
}
