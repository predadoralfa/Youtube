// cliente/src/World/scene/TargetMarker.jsx
import React, { useMemo } from "react";

/**
 * TargetMarker
 *
 * Overlay 2D "moderno" (cantos de um quadrado) para indicar alvo selecionado.
 * Não faz raycast, não acessa Three, não decide nada do mundo.
 *
 * Uso típico:
 * <TargetMarker
 *   visible={!!target}
 *   x={screenX}
 *   y={screenY}
 *   size={56}
 * />
 *
 * Onde (x,y) são coordenadas em pixels no espaço do container do canvas
 * (relativas ao canto superior esquerdo do container).
 */
export function TargetMarker({
  visible = false,
  x = 0,
  y = 0,
  size = 56,      // tamanho do quadrado externo
  corner = 14,    // comprimento de cada "canto"
  thickness = 2,  // espessura das linhas
  gap = 0,        // gap interno (se quiser "afastar" cantos do centro)
  opacity = 0.9,
  color = "rgba(90, 200, 250, 1)", // azul claro moderno (pode trocar)
  glow = true,
  zIndex = 40,
}) {
  const styleRoot = useMemo(() => {
    if (!visible) return { display: "none" };

    const half = size / 2;
    const g = Number(gap) || 0;

    return {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      opacity,
      zIndex,
      // opcional: leve glow
      filter: glow ? "drop-shadow(0 0 6px rgba(90,200,250,0.35))" : "none",
      // evita blur em alguns browsers
      willChange: "transform, left, top",
      // área clicável não importa (pointerEvents none), mas mantém consistente
      boxSizing: "border-box",
      // gap interno: empurra cantos levemente para fora do centro
      padding: `${g}px`,
      marginLeft: `${-g}px`,
      marginTop: `${-g}px`,
    };
  }, [visible, x, y, size, gap, opacity, glow, zIndex]);

  const cornerStyleBase = useMemo(() => {
    return {
      position: "absolute",
      width: `${corner}px`,
      height: `${corner}px`,
      boxSizing: "border-box",
    };
  }, [corner]);

  const line = useMemo(() => {
    // borda usando "L" com duas bordas
    return {
      borderColor: color,
      borderStyle: "solid",
      borderWidth: `${thickness}px`,
    };
  }, [color, thickness]);

  // Cada canto é um div com duas bordas ligadas; removemos as outras duas.
  const tl = useMemo(
    () => ({
      ...cornerStyleBase,
      ...line,
      left: 0,
      top: 0,
      borderRightWidth: 0,
      borderBottomWidth: 0,
    }),
    [cornerStyleBase, line]
  );

  const tr = useMemo(
    () => ({
      ...cornerStyleBase,
      ...line,
      right: 0,
      top: 0,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
    }),
    [cornerStyleBase, line]
  );

  const bl = useMemo(
    () => ({
      ...cornerStyleBase,
      ...line,
      left: 0,
      bottom: 0,
      borderRightWidth: 0,
      borderTopWidth: 0,
    }),
    [cornerStyleBase, line]
  );

  const br = useMemo(
    () => ({
      ...cornerStyleBase,
      ...line,
      right: 0,
      bottom: 0,
      borderLeftWidth: 0,
      borderTopWidth: 0,
    }),
    [cornerStyleBase, line]
  );

  return (
    <div style={styleRoot} aria-hidden="true">
      <div style={tl} />
      <div style={tr} />
      <div style={bl} />
      <div style={br} />
    </div>
  );
}