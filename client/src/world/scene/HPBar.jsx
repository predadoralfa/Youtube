/**
 * HPBar.jsx
 *
 * Componente reutilizável de barras vitais.
 * Pode ser usado:
 * - acima de entidades no mundo (posição fixa em tela)
 * - como HUD fixa do player
 *
 * Suporta:
 * - HP
 * - stamina (opcional)
 * - hunger
 * - thirst
 * - texto numérico opcional
 */

import React from "react";

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function VitalRow({
  width,
  height,
  current,
  max,
  fillColor,
  backgroundColor,
  borderColor,
  showText,
  textColor,
  fontSize,
  label,
}) {
  const safeCurrent = Math.max(0, toNum(current, 0));
  const safeMax = Math.max(0, toNum(max, 0));
  const percent = safeMax > 0 ? clamp01(safeCurrent / safeMax) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label ? (
        <div
          style={{
            color: "rgba(226, 232, 240, 0.88)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            lineHeight: 1,
            paddingLeft: 2,
          }}
        >
          {label}
        </div>
      ) : null}

      <div
        style={{
          position: "relative",
          width,
          height,
          backgroundColor,
          border: `1px solid ${borderColor}`,
          borderRadius: Math.max(4, Math.floor(height / 2)),
          overflow: "hidden",
          boxShadow: "0 0 8px rgba(0,0,0,0.8)",
        }}
      >
        <div
          style={{
            width: `${percent * 100}%`,
            height: "100%",
            backgroundColor: fillColor,
            transition: "width 0.12s linear",
            borderRadius: Math.max(3, Math.floor(height / 2) - 1),
          }}
        />

        {showText ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize,
              color: textColor,
              fontWeight: "bold",
              textShadow: "0 0 4px rgba(0,0,0,0.9)",
              lineHeight: 1,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {Math.floor(safeCurrent)} / {Math.floor(safeMax)}
          </div>
        ) : null}
      </div>

    </div>
  );
}

export function HPBar({
  visible = true,

  // posição em tela; se não vier, o componente pode ser usado como HUD normal
  x = null,
  y = null,

  // hp
  hpCurrent = 0,
  hpMax = 0,

  // stamina opcional
  staminaCurrent = null,
  staminaMax = null,
  hungerCurrent = null,
  hungerMax = null,
  thirstCurrent = null,
  thirstMax = null,
  immunityCurrent = null,
  immunityMax = null,
  feverCurrent = null,
  feverMax = null,
  sleepCurrent = null,
  sleepMax = null,

  // aparência
  width = 60,
  hpHeight = 14,
  staminaHeight = 10,
  hungerHeight = 10,
  thirstHeight = 10,
  gap = 6,

  // modo
  mode = "world", // "world" | "hud"
  showHpText = true,
  showStaminaText = false,
  showHungerText = false,
  showThirstText = false,
  showImmunityText = false,
  showFeverText = false,
  showSleepText = false,
  showStamina = false,
  showHunger = false,
  showThirst = false,
  showImmunity = false,
  showFever = false,
  showSleep = false,
  hpTextFontSize = "11px",
  staminaTextFontSize = "10px",
  hungerTextFontSize = "10px",
  thirstTextFontSize = "10px",
  immunityTextFontSize = "10px",
  feverTextFontSize = "10px",
  sleepTextFontSize = "10px",

  // cores
  hpColorHigh = "#ef4444",
  hpColorLow = "#b91c1c",
  staminaColor = "#facc15",
  hungerColor = "#38bdf8",
  thirstColor = "#22d3ee",
  immunityColor = "#60a5fa",
  feverColor = "#fb7185",
  sleepColor = "#34d399",
  trackColor = "#1a1a1a",
  borderColor = "#444",
  textColor = "#ffffff",
}) {
  const safeHpCurrent = Math.max(0, toNum(hpCurrent, 0));
  const safeHpMax = Math.max(0, toNum(hpMax, 0));

  if (!visible || safeHpMax <= 0) return null;

  const hpPercent = safeHpMax > 0 ? safeHpCurrent / safeHpMax : 0;
  const hpFillColor = hpPercent > 0.25 ? hpColorHigh : hpColorLow;

  const hasStamina =
    showStamina &&
    staminaCurrent != null &&
    staminaMax != null &&
    Number(staminaMax) > 0;

  const hasHunger =
    showHunger &&
    hungerCurrent != null &&
    hungerMax != null &&
    Number(hungerMax) > 0;

  const hasThirst =
    showThirst &&
    thirstCurrent != null &&
    thirstMax != null &&
    Number(thirstMax) > 0;
  const hasImmunity =
    showImmunity &&
    immunityCurrent != null &&
    immunityMax != null &&
    Number(immunityMax) > 0;
  const hasFever =
    showFever &&
    feverCurrent != null &&
    feverMax != null &&
    Number(feverMax) > 0;
  const hasSleep =
    showSleep &&
    sleepCurrent != null &&
    sleepMax != null &&
    Number(sleepMax) > 0;

  const wrapperStyle =
    mode === "hud"
      ? {
          pointerEvents: "none",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap,
        }
      : {
          position: "fixed",
          left: `${x ?? 0}px`,
          top: `${y ?? 0}px`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap,
        };

  return (
    <div style={wrapperStyle}>
      <VitalRow
        width={`${width}px`}
        height={hpHeight}
        current={safeHpCurrent}
        max={safeHpMax}
        fillColor={hpFillColor}
        backgroundColor={trackColor}
        borderColor={borderColor}
        showText={showHpText}
        textColor={textColor}
        fontSize={hpTextFontSize}
        label="HP"
      />

      {hasStamina ? (
        <VitalRow
          width={`${width}px`}
          height={staminaHeight}
          current={staminaCurrent}
          max={staminaMax}
          fillColor={staminaColor}
          backgroundColor={trackColor}
          borderColor={borderColor}
          showText={showStaminaText}
          textColor={textColor}
          fontSize={staminaTextFontSize}
          label="Stamina"
        />
      ) : null}

      {hasHunger ? (
        <VitalRow
          width={`${width}px`}
          height={hungerHeight}
          current={hungerCurrent}
          max={hungerMax}
          fillColor={hungerColor}
          backgroundColor={trackColor}
          borderColor={borderColor}
          showText={showHungerText}
          textColor={textColor}
          fontSize={hungerTextFontSize}
          label="Hunger"
        />
      ) : null}

      {hasThirst ? (
        <VitalRow
          width={`${width}px`}
          height={thirstHeight}
          current={thirstCurrent}
          max={thirstMax}
          fillColor={thirstColor}
          backgroundColor={trackColor}
          borderColor={borderColor}
          showText={showThirstText}
          textColor={textColor}
          fontSize={thirstTextFontSize}
          label="Thirst"
        />
      ) : null}

      {hasImmunity ? (
        <VitalRow
          width={`${width}px`}
          height={thirstHeight + 2}
          current={immunityCurrent}
          max={immunityMax}
          fillColor={immunityColor}
          backgroundColor={trackColor}
          borderColor={borderColor}
          showText={showImmunityText}
          textColor={textColor}
          fontSize={immunityTextFontSize}
          label="IMMUNITY"
        />
      ) : null}

      {hasFever ? (
        <VitalRow
          width={`${width}px`}
          height={thirstHeight + 2}
          current={feverCurrent}
          max={feverMax}
          fillColor={feverColor}
          backgroundColor={trackColor}
          borderColor={borderColor}
          showText={showFeverText}
          textColor={textColor}
          fontSize={feverTextFontSize}
          label="FEVER"
        />
      ) : null}

      {hasSleep ? (
        <VitalRow
          width={`${width}px`}
          height={thirstHeight + 2}
          current={sleepCurrent}
          max={sleepMax}
          fillColor={sleepColor}
          backgroundColor={trackColor}
          borderColor={borderColor}
          showText={showSleepText}
          textColor={textColor}
          fontSize={sleepTextFontSize}
          label="SLEEP"
        />
      ) : null}
    </div>
  );
}
