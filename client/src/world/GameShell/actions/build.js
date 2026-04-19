import { useCallback } from "react";

export function useGameShellBuildActions(state) {
  const beginBuildPlacement = useCallback(() => {
    const runtimePos = state.snapshot?.runtime?.pos ?? null;
    const x = Number(runtimePos?.x ?? NaN);
    const z = Number(runtimePos?.z ?? NaN);

    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

    state.setBuildPlacement({
      visible: true,
      active: true,
      kind: "PRIMITIVE_SHELTER",
      label: "Primitive Shelter",
      worldPos: { x, z },
    });
    state.setBuildOpen(false);
    return true;
  }, [state]);

  const clearBuildPlacement = useCallback(() => {
    state.setBuildPlacement(null);
  }, [state]);

  const emitBuildPlace = useCallback((worldPos) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const x = Number(worldPos?.x ?? NaN);
    const z = Number(worldPos?.z ?? NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

    s.emit(
      "build:place",
      {
        buildCode: "PRIMITIVE_SHELTER",
        kind: "PRIMITIVE_SHELTER",
        worldPos: { x, z },
      },
      (ack) => {
        if (ack?.ok === true) {
          state.setBuildPlacement(null);
          return;
        }

        state.setWorldNotifications((current) => [
          ...current,
          {
            id: `build-place-err:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
            text: ack?.message || ack?.code || "Falha ao posicionar a construção",
            tone: "warn",
            startedAt: Date.now(),
            ttlMs: 2200,
          },
        ].slice(-8));
      }
    );

    return true;
  }, [state]);

  const emitBuildCancel = useCallback((actorId) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const id = String(actorId ?? "");
    if (!id) return false;

    s.emit("build:cancel", { actorId: id }, (ack) => {
      if (ack?.ok === true) {
        state.setBuildPlacement(null);
        return;
      }

      state.setWorldNotifications((current) => [
        ...current,
        {
          id: `build-cancel-err:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: ack?.message || ack?.code || "Falha ao cancelar a construção",
          tone: "warn",
          startedAt: Date.now(),
          ttlMs: 2200,
        },
      ].slice(-8));
    });

    return true;
  }, [state]);

  const emitBuildPause = useCallback((actorId) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const id = String(actorId ?? "");
    if (!id) return false;

    s.emit("build:pause", { actorId: id }, (ack) => {
      if (ack?.ok === true) {
        return;
      }

      state.setWorldNotifications((current) => [
        ...current,
        {
          id: `build-pause-err:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: ack?.message || ack?.code || "Falha ao pausar a construção",
          tone: "warn",
          startedAt: Date.now(),
          ttlMs: 2200,
        },
      ].slice(-8));
    });

    return true;
  }, [state]);

  const emitBuildResume = useCallback((actorId) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const id = String(actorId ?? "");
    if (!id) return false;

    s.emit("build:resume", { actorId: id }, (ack) => {
      if (ack?.ok === true) {
        return;
      }

      state.setWorldNotifications((current) => [
        ...current,
        {
          id: `build-resume-err:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: ack?.message || ack?.code || "Falha ao retomar a construção",
          tone: "warn",
          startedAt: Date.now(),
          ttlMs: 2200,
        },
      ].slice(-8));
    });

    return true;
  }, [state]);

  const emitBuildStart = useCallback((actorId) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const id = String(actorId ?? "");
    if (!id) return false;

    s.emit("build:start", { actorId: id }, (ack) => {
      if (ack?.ok === true) {
        return;
      }

      state.setWorldNotifications((current) => [
        ...current,
        {
          id: `build-start-err:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: ack?.message || ack?.code || "Falha ao iniciar a construção",
          tone: "warn",
          startedAt: Date.now(),
          ttlMs: 2200,
        },
      ].slice(-8));
    });

    return true;
  }, [state]);

  return {
    beginBuildPlacement,
    clearBuildPlacement,
    emitBuildPlace,
    emitBuildCancel,
    emitBuildPause,
    emitBuildResume,
    emitBuildStart,
  };
}
