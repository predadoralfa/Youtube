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

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("world:resync");
  }, [hasToken]);

  const handleLogin = (token) => {
    localStorage.setItem("token", token);
    setHasToken(true);
  };
  
  if (!hasToken) {
    return <AuthPage onLoggedIn={handleLogin} />;
  }

  return <GameShell />;
}
