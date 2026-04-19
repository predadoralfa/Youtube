import { useEffect, useState } from "react";
import { InventoryItemIcon } from "../../InventoryItemIconBridge";

function formatCraftTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms ?? 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function CraftTab({ craftRecipes, onCraftRecipe, onClaimCraftJob, setLocalNotice }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!craftRecipes.length) {
    return (
      <div className="inv-tab-placeholder inv-tab-placeholder--craft">
        <div className="inv-tab-placeholder-title">Craft</div>
        <div className="inv-tab-placeholder-text">
          No recipes unlocked yet. Press R to open Research, complete your first studies, and come back here to start
          crafting.
        </div>
      </div>
    );
  }

  return (
    <div className="inv-tab-placeholder inv-tab-placeholder--craft craft-list">
      {craftRecipes.map((recipe) => {
        const outputItem = recipe.outputItemDef ?? null;
        const label = outputItem?.name || recipe.name || recipe.code || "Craft";
        const activeJob = recipe.activeJob ?? null;
        const activeStartedAtMs = Number(activeJob?.startedAtMs ?? activeJob?.started_at_ms ?? nowMs);
        const activeCraftTimeMs = Number(activeJob?.craftTimeMs ?? activeJob?.craft_time_ms ?? 0);
        const activeIsDue =
          activeJob &&
          String(activeJob.status ?? "").toUpperCase() === "RUNNING" &&
          activeCraftTimeMs > 0 &&
          nowMs - activeStartedAtMs >= activeCraftTimeMs;
        const readyJob = recipe.readyJob ?? (activeIsDue ? activeJob : null);
        const isReady = Boolean(readyJob);
        const canCraft = Boolean(recipe.canCraft);
        const blockReason = recipe.blockReason || "Put the required items in HAND_L or HAND_R first";
        const ingredients = recipe.recipeItems ?? [];

        return (
          <article className="craft-card" key={recipe.id ?? recipe.code}>
            <div className="craft-card-main">
              <InventoryItemIcon itemDef={outputItem} label={label} className="craft-icon" />
              <div className="craft-copy">
                <div className="craft-name">{label}</div>
                <div className="craft-meta">
                  {ingredients.map((ingredient) => {
                    const ingredientDef = ingredient.itemDef ?? null;
                    const ingredientName = ingredientDef?.name || ingredientDef?.code || "Ingredient";
                    return (
                      <span key={ingredient.id ?? ingredient.itemDefId ?? ingredientName}>
                        {ingredientName} {Number(ingredient.quantity ?? 0)}x
                      </span>
                    );
                  })}
                  <span>{formatCraftTime(recipe.craftTimeMs)}</span>
                  <span>{Number(recipe.staminaCostTotal ?? 0)} stamina</span>
                </div>
              </div>
              <button
                type="button"
                className="craft-action"
                title={isReady ? "Move to inventory" : canCraft ? "Craft" : blockReason}
                disabled={!isReady && !canCraft}
                onClick={() => {
                  if (isReady) {
                    if (!onClaimCraftJob) {
                      setLocalNotice?.("Craft collect is not connected yet.");
                      return;
                    }
                    onClaimCraftJob(readyJob);
                    return;
                  }
                  if (!onCraftRecipe) {
                    setLocalNotice?.("Craft execution is not connected yet.");
                    return;
                  }
                  if (!canCraft) {
                    setLocalNotice?.(blockReason);
                    return;
                  }
                  onCraftRecipe(recipe);
                }}
              >
                {isReady ? "Take" : "🔨"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
