import React, { useMemo } from "react";

export function BuildTraceMarker({
  visible = false,
  x = 0,
  y = 0,
  width = 128,
  height = 64,
  color = "rgba(255,255,255,0.95)",
  opacity = 0.9,
  zIndex = 38,
  label = "Primitive Shelter",
}) {
  const styleRoot = useMemo(() => {
    if (!visible) return { display: "none" };
    return {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      opacity,
      zIndex,
      boxSizing: "border-box",
      filter: "drop-shadow(0 0 6px rgba(255,255,255,0.15))",
      willChange: "transform, left, top",
    };
  }, [visible, x, y, width, height, opacity, zIndex]);

  const corner = useMemo(
    () => ({
      position: "absolute",
      width: "18px",
      height: "18px",
      boxSizing: "border-box",
      borderColor: color,
      borderStyle: "solid",
      borderWidth: "2px",
    }),
    [color]
  );

  const tl = useMemo(
    () => ({ ...corner, left: 0, top: 0, borderRightWidth: 0, borderBottomWidth: 0 }),
    [corner]
  );
  const tr = useMemo(
    () => ({ ...corner, right: 0, top: 0, borderLeftWidth: 0, borderBottomWidth: 0 }),
    [corner]
  );
  const bl = useMemo(
    () => ({ ...corner, left: 0, bottom: 0, borderRightWidth: 0, borderTopWidth: 0 }),
    [corner]
  );
  const br = useMemo(
    () => ({ ...corner, right: 0, bottom: 0, borderLeftWidth: 0, borderTopWidth: 0 }),
    [corner]
  );

  const labelStyle = useMemo(
    () => ({
      position: "absolute",
      left: "50%",
      bottom: "-18px",
      transform: "translateX(-50%)",
      color,
      fontSize: "0.7rem",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      textShadow: "0 0 8px rgba(255,255,255,0.18)",
    }),
    [color]
  );

  return (
    <div style={styleRoot} aria-hidden="true">
      <div style={tl} />
      <div style={tr} />
      <div style={bl} />
      <div style={br} />
      <div style={labelStyle}>{label}</div>
    </div>
  );
}
