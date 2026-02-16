// src/components/overlays/LoadingOverlay.jsx
export function LoadingOverlay({ message = "Carregando..." }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        userSelect: "none"
      }}
    >
      <h1
        style={{
          color: "#fff",
          margin: 0,
          fontSize: 28,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          fontWeight: 700
        }}
      >
        {message}
      </h1>
    </div>
  );
}
