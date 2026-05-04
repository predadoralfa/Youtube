import { useState } from "react";

export function AuthPage({ onLoggedIn }) {
  const [token, setToken] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextToken = String(token ?? "").trim();
    if (!nextToken) return;
    onLoggedIn?.(nextToken);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(244,185,66,0.12), transparent 35%), linear-gradient(180deg, #081018 0%, #0b1218 100%)",
        color: "#f4f1e8",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(92vw, 420px)",
          display: "grid",
          gap: 14,
          padding: 24,
          borderRadius: 20,
          background: "rgba(14, 20, 28, 0.9)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div>
          <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.72 }}>
            Scene Creator
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 26 }}>Entrar no editor</h1>
        </div>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Token de acesso</span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            placeholder="Cole seu token aqui"
            autoComplete="current-password"
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(6, 10, 14, 0.92)",
              color: "#f4f1e8",
              padding: "12px 14px",
              outline: "none",
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            border: 0,
            borderRadius: 12,
            padding: "12px 14px",
            background: "#f4b942",
            color: "#18212a",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
