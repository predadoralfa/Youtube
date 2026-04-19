import { useCallback } from "react";

export function useGameShellSleepActions(state) {
  const emitSleepStart = useCallback((actorId) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const id = String(actorId ?? "");
    if (!id) return false;

    s.emit("sleep:start", { actorId: id }, (ack) => {
      if (ack?.ok === true) {
        state.clearTargetBuildCard?.();
        return;
      }

      state.setWorldNotifications((current) => [
        ...current,
        {
          id: `sleep-start-err:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: ack?.message || ack?.code || "Falha ao iniciar o descanso",
          tone: "warn",
          startedAt: Date.now(),
          ttlMs: 2200,
        },
      ].slice(-8));
    });

    return true;
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
