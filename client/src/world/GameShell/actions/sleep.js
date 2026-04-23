import { useCallback } from "react";

export function useGameShellSleepActions(state) {
  const emitSleepStart = useCallback((actorId) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const id = String(actorId ?? "");
    if (!id) return false;

    return new Promise((resolve) => {
      s.emit("sleep:start", { actorId: id }, (ack) => {
        if (ack?.ok === true) {
          state.clearTargetBuildCard?.();
          resolve(ack);
          return;
        }

        resolve(ack ?? { ok: false, code: "SLEEP_ERR", message: "I'm not sleepy right now." });
      });
    });
  }, [state]);

  const emitSleepStop = useCallback(() => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    s.emit("sleep:stop", {}, (ack) => {
      if (ack?.ok === true) {
        return;
      }

      state.setWorldNotifications((current) => [
        ...current,
        {
          id: `sleep-stop-err:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: ack?.message || ack?.code || "Falha ao encerrar o descanso",
          tone: "warn",
          startedAt: Date.now(),
          ttlMs: 2200,
        },
      ].slice(-8));
    });

    return true;
  }, [state]);

  return {
    emitSleepStart,
    emitSleepStop,
  };
}
