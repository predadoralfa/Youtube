import { FloatingDamageText } from "../FloatingDamageText";
import { FloatingLootText } from "../FloatingLootText";
import { BuildTraceMarker } from "../BuildTraceMarker";
import { HPBar } from "../HPBar";
import { TargetEnemyCard } from "../TargetEnemyCard";
import { TargetLootCard } from "../TargetLootCard";
import { TargetPlayerCard } from "../TargetPlayerCard";
import { TargetMarker } from "../TargetMarker";
import { TargetBuildCard } from "../TargetBuildCard";

export function GameCanvasView({
  state,
  lootNotifications = [],
  worldNotifications = [],
  onClearBuildPlacement = null,
  onCancelBuild = null,
  onCloseTargetBuildCard = null,
}) {
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
      onContextMenu={(e) => {
        if (state.buildPlacementRef?.current?.visible || state.targetBuildCard) {
          e.preventDefault();
        }
      }}
    >
      <div style={{ position: "fixed", inset: 0, zIndex: 1090, pointerEvents: "none" }}>
        <FloatingDamageText damages={state.floatingDamages} />
      </div>

      <div style={{ position: "fixed", inset: 0, zIndex: 1090, pointerEvents: "none" }}>
        <FloatingLootText loots={lootNotifications} />
      </div>

      <div style={{ position: "fixed", inset: 0, zIndex: 1090, pointerEvents: "none" }}>
        <FloatingLootText loots={worldNotifications} />
      </div>

      <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
        <TargetMarker visible={state.marker.visible} x={state.marker.x} y={state.marker.y} />

        <BuildTraceMarker
          visible={state.buildPlacementMarker?.visible ?? false}
          x={state.buildPlacementMarker?.x ?? 0}
          y={state.buildPlacementMarker?.y ?? 0}
          width={state.buildPlacementMarker?.width ?? 128}
          height={state.buildPlacementMarker?.height ?? 64}
          label={state.buildPlacementMarker?.label ?? "Primitive Shelter"}
        />

        {state.targetLootCard ? (
          <TargetLootCard
            visible={true}
            x={state.targetLootCard.x}
            y={state.targetLootCard.y}
            actorName={state.targetLootCard.actorName}
            lootSummary={state.targetLootCard.lootSummary}
          />
        ) : null}

        {state.targetPlayerCard ? (
          <TargetPlayerCard
            visible={true}
            displayName={state.targetPlayerCard.displayName}
            hpCurrent={state.targetPlayerCard.hpCurrent}
            hpMax={state.targetPlayerCard.hpMax}
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
              hpHeight={22}
              staminaHeight={16}
              hungerHeight={16}
              thirstHeight={16}
              hpCurrent={state.selfHpBar.hpCurrent}
              hpMax={state.selfHpBar.hpMax}
              staminaCurrent={state.selfHpBar.staminaCurrent}
              staminaMax={state.selfHpBar.staminaMax}
              showHpText={true}
              showStamina={true}
              showStaminaText={true}
              showHunger={false}
              showThirst={false}
              showImmunity={false}
              showFever={false}
              showSleep={false}
              hpTextFontSize="11px"
              staminaTextFontSize="10px"
              hungerTextFontSize="10px"
              thirstTextFontSize="10px"
              immunityTextFontSize="10px"
              feverTextFontSize="10px"
              sleepTextFontSize="10px"
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

      {state.targetBuildCard ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1126,
            pointerEvents: "auto",
            background: "transparent",
          }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            onCloseTargetBuildCard?.();
          }}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
        >
          <TargetBuildCard
            visible={true}
            x={state.targetBuildCard.x}
            y={state.targetBuildCard.y}
            displayName={state.targetBuildCard.displayName}
            ownerName={state.targetBuildCard.ownerName}
            stateLabel={state.targetBuildCard.stateLabel}
            canCancel={state.targetBuildCard.canCancel}
            canBuild={state.targetBuildCard.canBuild}
            canSleep={state.targetBuildCard.canSleep}
            buildState={state.targetBuildCard.buildState}
            buildDurationLabel={state.targetBuildCard.buildDurationLabel}
            xpReward={state.targetBuildCard.xpReward}
            onCancel={state.targetBuildCard.onCancel}
            onBuild={state.targetBuildCard.onBuild}
            onSleep={state.targetBuildCard.onSleep}
            onClose={onCloseTargetBuildCard}
          />
        </div>
      ) : null}
    </div>
  );
}
