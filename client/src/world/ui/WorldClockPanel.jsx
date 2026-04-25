import { useEffect, useState } from "react";
import { useWorldClock } from "@/world/hooks/useWorldClock";

function pad2(value) {
  return String(value ?? 0).padStart(2, "0");
}

export function WorldClockPanel({ worldClock }) {
  const [open, setOpen] = useState(false);
  const [showCloseBar, setShowCloseBar] = useState(false);
  const currentTime = useWorldClock(worldClock);

  useEffect(() => {
    if (!open) {
      setShowCloseBar(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowCloseBar(true);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [open]);

  if (!currentTime) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 34,
        right: 16,
        zIndex: 1103,
        width: open ? 252 : 28,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "flex-end",
        transition: "width 0.32s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            width: open ? (showCloseBar ? 22 : 0) : 28,
            minWidth: open ? (showCloseBar ? 22 : 0) : 28,
            borderRadius: 14,
            borderTopRightRadius: open && showCloseBar ? 0 : 14,
            borderBottomRightRadius: open && showCloseBar ? 0 : 14,
            background: "linear-gradient(180deg, #38bdf8 0%, #2563eb 55%, #172554 100%)",
            border: "1px solid rgba(56, 189, 248, 0.95)",
            boxShadow: "0 0 10px rgba(56,189,248,0.75), 0 0 22px rgba(37,99,235,0.55)",
            color: "#eff6ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            userSelect: "none",
            opacity: open && !showCloseBar ? 0 : 1,
            visibility: open && !showCloseBar ? "hidden" : "visible",
            overflow: "hidden",
            fontSize: open ? 13 : 16,
            fontWeight: 700,
            transition: "width 0.32s ease, min-width 0.32s ease, opacity 0.18s ease, box-shadow 0.32s ease",
          }}
          onClick={() => setOpen((value) => !value)}
          title={open ? "Close world clock" : "Open world clock"}
        >
          {open ? (showCloseBar ? "<" : "") : "🕒"}
        </div>

        {open ? (
          <div
            style={{
              width: 230,
              background: "linear-gradient(180deg, rgba(14,22,34,0.92), rgba(8,12,20,0.9))",
              borderTop: "1px solid rgba(148, 163, 184, 0.35)",
              borderRight: "1px solid rgba(148, 163, 184, 0.35)",
              borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
              borderTopRightRadius: 14,
              borderBottomRightRadius: 14,
              boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
              color: "#f8fafc",
              padding: "14px 16px",
              backdropFilter: "blur(6px)",
              transformOrigin: "right center",
              animation: "worldClockSlideOpen 340ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <style>
              {`
                @keyframes worldClockSlideOpen {
                  0% {
                    opacity: 0;
                    transform: translateX(18px) scaleX(0.78) scaleY(0.92);
                  }
                  100% {
                    opacity: 1;
                    transform: translateX(0) scaleX(1) scaleY(1);
                  }
                }
              `}
            </style>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(191, 219, 254, 0.85)",
                marginBottom: 6,
              }}
            >
              World Clock
            </div>

            <div
              style={{
                fontSize: 34,
                lineHeight: 1,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {pad2(currentTime.hour)}:{pad2(currentTime.minute)}
            </div>

            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Day {currentTime.day} of {currentTime.monthMeta?.name ?? `Month ${currentTime.month}`} - Year {currentTime.year}
            </div>

            {currentTime.monthMeta?.description ? (
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "rgba(226, 232, 240, 0.82)",
                  marginBottom: 10,
                }}
              >
                {currentTime.monthMeta.description}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 11,
                color: "rgba(148, 163, 184, 0.95)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              <span>{currentTime.isNight ? "Night" : "Daylight"}</span>
              <span>{currentTime.monthMeta?.season ?? "season-unknown"}</span>
              <span>{currentTime.monthMeta?.mood ?? "mood-unknown"}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
