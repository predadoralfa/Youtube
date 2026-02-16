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
      console.log("[GAMESHELL] bootstrap start");
      try {
        const data = await bootstrapWorld(token);
        console.log("[GAMESHELL] bootstrap done", data);

        if (!data || data?.error) {
          console.error("[GAMESHELL] bootstrap error:", data);

          if (data?.status === 401) {
            localStorage.removeItem("token");
            window.location.reload();
            return;
          }

          return;
        }

        setSnapshot(data.snapshot);
        console.log("[GAMESHELL] snapshot set", data.snapshot);
      } catch (err) {
        console.error("[GAMESHELL] exception:", err);
      } finally {
        setLoading(false);
        console.log("[GAMESHELL] loading=false");
      }
    })();
  }, []);

  if (loading) return <LoadingOverlay message="Carregando mundo..." />;

  // Sem snapshot não renderiza nada (fase 1)
  if (!snapshot) return <LoadingOverlay message="Falha ao carregar mundo" />;

  return <GameCanvas snapshot={snapshot} />;
}
