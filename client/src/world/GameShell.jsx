import { useEffect, useState } from "react";
import { GameCanvas } from "./scene/GameCanvas";
import { bootstrapWorld } from "@/services/World";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay";

export function GameShell() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      const data = await bootstrapWorld(token);

      if (data?.error) {
        console.error("[GAMESHELL] bootstrap error:", data);

        if (data.status === 401) {
          localStorage.removeItem("token");
          window.location.reload();
          return;
        }

        setLoading(false);
        return;
      }

      setSnapshot(data.snapshot);
      console.log("[SHELL], Snapshot", data.snapshot)
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingOverlay message="Carregando mundo..." />;

  // Sem snapshot não renderiza nada (fase 1)
  if (!snapshot) return <LoadingOverlay message="Falha ao carregar mundo" />;

  return <GameCanvas snapshot={snapshot} />;
}
