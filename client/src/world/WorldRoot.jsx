import { useEffect, useState } from "react";
import { AuthPage } from "@/pages/AuthPage";
import { GameShell } from "@/World/GameShell";
import { getSocket } from "@/services/Socket";

export function WorldRoot() {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setHasToken(!!token);
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem("token", token);
    setHasToken(true);
  };

  // =============================
  // RESYNC DEV (F9)
  // =============================
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "F9") {
        const socket = getSocket();
        if (socket) {
          console.log("[WORLD] manual resync requested (F9)");
          socket.emit("world:resync");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!hasToken) {
    return <AuthPage onLoggedIn={handleLogin} />;
  }

  return <GameShell />;
}