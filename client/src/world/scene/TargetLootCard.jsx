import React from "react";

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeItems(lootSummary) {
  const items = Array.isArray(lootSummary?.items) ? lootSummary.items : [];
  return items
    .map((item) => {
      const qty = Math.max(0, Math.floor(toNum(item?.qty, 0)));
      const name = String(item?.name ?? item?.code ?? "Item").trim();
      return { ...item, qty, name };
    })
    .filter((item) => item.qty > 0);
}

export function TargetLootCard({
  visible = true,
  x = null,
  y = null,
  lootSummary = null,
  width = 190,
}) {
  if (!visible) return null;

  const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
  const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
  const items = normalizeItems(lootSummary);

  if (items.length === 0) return null;

  const visibleItems = items.slice(0, 3);
  const moreCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div
      style={{
        position: "fixed",
        left: `${safeX}px`,
        top: `${safeY}px`,
        transform: "translate(-50%, -115%)",
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
        padding: "10px 12px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(11, 19, 34, 0.96), rgba(7, 12, 22, 0.92))",
        border: "1px solid rgba(45, 212, 191, 0.55)",
        boxShadow:
          "0 10px 28px rgba(0, 0, 0, 0.45), 0 0 18px rgba(34, 211, 238, 0.12)",
        color: "#e5f9ff",
        pointerEvents: "none",
        zIndex: 1125,
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "rgba(103, 232, 249, 0.85)",
          marginBottom: 6,
          fontWeight: 700,
        }}
      >
        Container
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {visibleItems.map((item, index) => (
          <div
            key={`${item.itemInstanceId ?? item.itemDefId ?? item.code ?? index}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 13,
              lineHeight: 1.2,
              color: "#f8fdff",
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.name}
            </span>
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                color: "#67e8f9",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              x{item.qty}
            </span>
          </div>
        ))}

        {moreCount > 0 ? (
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              color: "rgba(191, 219, 254, 0.78)",
            }}
          >
            +{moreCount} more
          </div>
        ) : null}
      </div>
    </div>
  );
}
