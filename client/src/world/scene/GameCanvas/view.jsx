import { FloatingDamageText } from "../FloatingDamageText";
import { FloatingLootText } from "../FloatingLootText";
import { HPBar } from "../HPBar";
import { TargetEnemyCard } from "../TargetEnemyCard";
import { TargetLootCard } from "../TargetLootCard";
import { TargetMarker } from "../TargetMarker";

export function GameCanvasView({ state, lootNotifications = [] }) {
  return (
    <div
      ref={state.containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        isolation: "isolate",
      }}
    >
      <div style={{ position: "fixed", inset: 0, zIndex: 1090, pointerEvents: "none" }}>
        <FloatingDamageText damages={state.floatingDamages} />
      </div>

      <div style={{ position: "fixed", inset: 0, zIndex: 1090, pointerEvents: "none" }}>
        <FloatingLootText loots={lootNotifications} />
      </div>

      <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
        <TargetMarker visible={state.marker.visible} x={state.marker.x} y={state.marker.y} />

        {state.targetLootCard ? (
          <TargetLootCard
            visible={true}
            x={state.targetLootCard.x}
            y={state.targetLootCard.y}
            actorName={state.targetLootCard.actorName}
            lootSummary={state.targetLootCard.lootSummary}
          />
        ) : null}

        {state.selfHpBar ? (
          <div
            style={{
              position: "fixed",
              left: 16,
              top: 16,
              zIndex: 1100,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <HPBar
              visible={true}
              mode="hud"
              width={220}
              hpHeight={18}
              staminaHeight={12}
              hungerHeight={12}
              hpCurrent={state.selfHpBar.hpCurrent}
              hpMax={state.selfHpBar.hpMax}
              staminaCurrent={state.selfHpBar.staminaCurrent}
              staminaMax={state.selfHpBar.staminaMax}
              hungerCurrent={state.selfHpBar.hungerCurrent}
              hungerMax={state.selfHpBar.hungerMax}
              showHpText={true}
              showStamina={true}
              showStaminaText={true}
              showHunger={true}
              showHungerText={true}
            />
          </div>
        ) : null}

        {state.targetHpBar ? (
          <TargetEnemyCard
            visible={true}
            x={state.targetHpBar.x}
            y={state.targetHpBar.y}
            enemyName={state.targetHpBar.displayName}
            hpCurrent={state.targetHpBar.hpCurrent}
            hpMax={state.targetHpBar.hpMax}
          />
        ) : null}
      </div>
    </div>
  );
}
