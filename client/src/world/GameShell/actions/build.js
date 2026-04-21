import { useCallback } from "react";
import { resolveHeldSourceSlotsForCode } from "@/world/build/requirements";

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

    return new Promise((resolve) => {
      s.emit("build:resume", { actorId: id }, (ack) => {
        resolve(ack ?? null);
      });
    });
  }, [state]);

  const emitBuildStart = useCallback((actorId) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const id = String(actorId ?? "");
    if (!id) return false;

    console.log("[BUILD][CLIENT] emit build:start", {
      actorId: id,
      runtimePos: state.snapshot?.runtime?.pos ?? null,
    });

    s.emit("build:start", { actorId: id }, (ack) => {
      console.log("[BUILD][CLIENT] ack build:start", {
        actorId: id,
        ok: ack?.ok ?? null,
        pending: ack?.pending ?? null,
        code: ack?.code ?? null,
        message: ack?.message ?? null,
      });
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

  const emitBuildDepositMaterial = useCallback((actorId, itemCode, qty) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return Promise.resolve({ ok: false, code: "SOCKET_OFFLINE" });

    const id = String(actorId ?? "");
    const code = String(itemCode ?? "").trim().toUpperCase();
    const amount = Number(qty ?? 0);
    if (!id) return Promise.resolve({ ok: false, code: "INVALID_ACTOR_ID", message: "Invalid actor id" });
    if (!code) return Promise.resolve({ ok: false, code: "INVALID_ITEM_CODE", message: "Invalid item code" });
    if (!Number.isInteger(amount) || amount <= 0) {
      return Promise.resolve({ ok: false, code: "INVALID_QTY", message: "Invalid quantity" });
    }

    const actorState =
      Array.isArray(state.snapshot?.actors)
        ? state.snapshot.actors.find((actor) => String(actor?.id) === id)?.state ?? null
        : null;
    const buildMaterialsSlotRole =
      String(actorState?.buildMaterialsSlotRole ?? actorState?.build_materials_slot_role ?? `BUILD_MATERIALS:${id}`)
        .trim() || `BUILD_MATERIALS:${id}`;

    const sourceSlots = resolveHeldSourceSlotsForCode(
      state.inventorySnapshot ?? state.inventorySnapshotRef?.current ?? null,
      code
    );
    if (!Array.isArray(sourceSlots) || sourceSlots.length === 0) {
      return Promise.resolve({
        ok: false,
        code: "NO_HELD_MATERIAL",
        message: `Put ${code.replace(/_/g, " ").toLowerCase()} in your hands first.`,
      });
    }
    const totalHeld = sourceSlots.reduce((sum, slot) => sum + Math.max(0, Number(slot?.qty ?? 0)), 0);
    if (amount > totalHeld) {
      return Promise.resolve({
        ok: false,
        code: "INSUFFICIENT_HELD_QTY",
        message: `You only have ${totalHeld} in hand.`,
      });
    }

    return new Promise((resolve) => {
      const depositNext = (remaining, index) => {
        if (remaining <= 0) {
          resolve({ ok: true, ack: null });
          return;
        }

        const source = sourceSlots[index];
        if (!source) {
          resolve({
            ok: false,
            code: "BUILD_DEPOSIT_FAILED",
            message: "Failed to deposit materials",
            ack: null,
          });
          return;
        }

        const qtyToMove = Math.min(remaining, Math.max(0, Number(source.qty ?? 0)));
        if (qtyToMove <= 0) {
          depositNext(remaining, index + 1);
          return;
        }

        if (String(source.kind ?? "INVENTORY").toUpperCase() === "EQUIPMENT") {
          s.emit(
            "build:deposit",
            {
              actorId: id,
              itemInstanceId: source.itemInstanceId,
              itemCode: code,
              qty: qtyToMove,
            },
            (ack) => {
              if (ack?.ok !== true) {
                resolve({
                  ok: false,
                  code: ack?.code || "BUILD_DEPOSIT_FAILED",
                  message: ack?.message || "Failed to deposit materials",
                  ack: ack ?? null,
                });
                return;
              }

              depositNext(remaining - qtyToMove, index + 1);
            }
          );
          return;
        }

        s.emit(
          "inv:move",
          {
            from: {
              role: source.role,
              slot: Number(source.slotIndex),
              slotIndex: Number(source.slotIndex),
            },
            to: {
              role: buildMaterialsSlotRole,
              slot: 0,
              slotIndex: 0,
            },
            qty: qtyToMove,
          },
          (ack) => {
            if (ack?.ok !== true) {
              resolve({
                ok: false,
                code: ack?.code || "BUILD_DEPOSIT_FAILED",
                message: ack?.message || "Failed to deposit materials",
                ack: ack ?? null,
              });
              return;
            }

            depositNext(remaining - qtyToMove, index + 1);
          }
        );
      };

      depositNext(amount, 0);
    });
  }, [state]);

  return {
    beginBuildPlacement,
    clearBuildPlacement,
    emitBuildPlace,
    emitBuildCancel,
    emitBuildPause,
    emitBuildResume,
    emitBuildStart,
    emitBuildDepositMaterial,
  };
}
