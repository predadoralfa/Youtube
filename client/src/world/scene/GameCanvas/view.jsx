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
  const hungerMax = Number(state.selfHpBar?.hungerMax ?? 0);
  const thirstMax = Number(state.selfHpBar?.thirstMax ?? 0);
  const hungerCurrent = Number(state.selfHpBar?.hungerCurrent ?? 0);
  const thirstCurrent = Number(state.selfHpBar?.thirstCurrent ?? 0);
  const hungerRatio = hungerMax > 0 ? hungerCurrent / hungerMax : 1;
  const thirstRatio = thirstMax > 0 ? thirstCurrent / thirstMax : 1;
  const hungerVisible = hungerMax > 0 && hungerRatio <= 0.3;
  const thirstVisible = thirstMax > 0 && thirstRatio <= 0.3;
  const immunityMax = Number(state.selfHpBar?.immunityMax ?? 0);
  const sleepMax = Number(state.selfHpBar?.sleepMax ?? 0);
  const immunityCurrent = Number(state.selfHpBar?.immunityCurrent ?? 0);
  const sleepCurrent = Number(state.selfHpBar?.sleepCurrent ?? 0);
  const immunityRatio = immunityMax > 0 ? immunityCurrent / immunityMax : 1;
  const sleepRatio = sleepMax > 0 ? sleepCurrent / sleepMax : 1;
  const immunityVisible = immunityMax > 0 && immunityRatio <= 0.3;
  const sleepVisible = sleepMax > 0 && sleepRatio <= 0.3;
  const hungerCritical = hungerMax > 0 && hungerCurrent <= 5;
  const thirstCritical = thirstMax > 0 && thirstCurrent <= 5;
  const immunityCritical = immunityMax > 0 && immunityCurrent <= 5;
  const sleepCritical = sleepMax > 0 && sleepCurrent <= 5;
  const hungerPulseColor = hungerCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 146, 60, 0.9)";
  const thirstPulseColor = thirstCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 146, 60, 0.9)";
  const immunityPulseColor = immunityCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 146, 60, 0.9)";
  const sleepPulseColor = sleepCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 146, 60, 0.9)";

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
              width={330}
              hpHeight={25}
              staminaHeight={18}
              hungerHeight={16}
              thirstHeight={16}
              hpCurrent={state.selfHpBar.hpCurrent}
              hpMax={state.selfHpBar.hpMax}
              staminaCurrent={state.selfHpBar.staminaCurrent}
              staminaMax={state.selfHpBar.staminaMax}
              hungerCurrent={state.selfHpBar.hungerCurrent}
              hungerMax={state.selfHpBar.hungerMax}
              thirstCurrent={state.selfHpBar.thirstCurrent}
              thirstMax={state.selfHpBar.thirstMax}
              feverCurrent={state.selfHpBar.feverCurrent}
              feverMax={state.selfHpBar.feverMax}
              feverPercent={state.selfHpBar.feverPercent}
              immunityCurrent={state.selfHpBar.immunityCurrent}
              immunityMax={state.selfHpBar.immunityMax}
              sleepCurrent={state.selfHpBar.sleepCurrent}
              sleepMax={state.selfHpBar.sleepMax}
              showHpText={true}
              showStamina={true}
              showStaminaText={true}
              showHunger={hungerVisible}
              showHungerText={hungerVisible}
              showThirst={thirstVisible}
              showThirstText={thirstVisible}
              hungerPulse={hungerVisible}
              thirstPulse={thirstVisible}
              hungerPulseColor={hungerPulseColor}
              thirstPulseColor={thirstPulseColor}
              showImmunity={immunityVisible}
              showImmunityText={immunityVisible}
              immunityPulse={immunityVisible}
              immunityPulseColor={immunityPulseColor}
              showFever={true}
              showFeverText={true}
              showSleep={sleepVisible}
              showSleepText={sleepVisible}
              sleepPulse={sleepVisible}
              sleepPulseColor={sleepPulseColor}
              hpTextFontSize="15px"
              staminaTextFontSize="13px"
              hungerTextFontSize="11px"
              thirstTextFontSize="11px"
              immunityTextFontSize="10px"
              feverTextFontSize="11px"
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
            canPause={state.targetBuildCard.canPause}
            canResume={state.targetBuildCard.canResume}
            canDeposit={state.targetBuildCard.canDeposit}
            canSleep={state.targetBuildCard.canSleep}
            canDismantle={state.targetBuildCard.canDismantle}
            sleepCurrent={state.targetBuildCard.sleepCurrent}
            sleepMax={state.targetBuildCard.sleepMax}
            buildState={state.targetBuildCard.buildState}
            buildDurationLabel={state.targetBuildCard.buildDurationLabel}
            xpReward={state.targetBuildCard.xpReward}
            onCancel={state.targetBuildCard.onCancel}
            onPause={state.targetBuildCard.onPause}
            onResume={state.targetBuildCard.onResume}
            onBuild={state.targetBuildCard.onBuild}
            onDepositMaterial={state.targetBuildCard.onDepositMaterial}
            onSleep={state.targetBuildCard.onSleep}
            onDismantle={state.targetBuildCard.onDismantle}
            onClose={onCloseTargetBuildCard}
          />
        </div>
      ) : null}
    </div>
  );
}
