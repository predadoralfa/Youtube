import { useEffect } from "react";
import * as THREE from "three";
import { getSocket } from "@/services/Socket";
import { projectWorldToScreenPx } from "../helpers";

export function useDamageSocket(state, worldStoreRef, damageTtlMs) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const applyDamageEvent = (data, fallbackKind = "DEFAULT") => {
      if (!data) return;

      const { eventId, targetId, damage, targetHPAfter, targetHPMax } = data;
      if (targetId == null || damage == null) return;
      if (eventId && state.seenDamageEventIdsRef.current.has(String(eventId))) return;
      if (eventId) state.seenDamageEventIdsRef.current.add(String(eventId));

      const targetKey = String(targetId);
      const exactDamage = Number.isFinite(Number(damage)) ? Number(damage) : 0;
      let worldPos = state.entityPositionsRef.current.get(targetKey);

      if (!worldPos) {
        const mesh =
          state.meshByEntityIdRef.current.get(targetKey) ??
          state.meshByEnemyIdRef.current.get(targetKey) ??
          state.meshByActorIdRef.current.get(targetKey) ??
          null;

        if (mesh?.getWorldPosition) {
          const meshWorldPos = new THREE.Vector3();
          mesh.getWorldPosition(meshWorldPos);
          worldPos = { x: meshWorldPos.x, y: meshWorldPos.y, z: meshWorldPos.z };
        }
      }

      let screenX = null;
      let screenY = null;
      if (worldPos && state.containerRef.current && state.cameraRef.current) {
        const screenPos = projectWorldToScreenPx(
          new THREE.Vector3(worldPos.x, worldPos.y + 1.2, worldPos.z),
          state.cameraRef.current,
          state.containerRef.current
        );
        if (screenPos) {
          screenX = screenPos.x;
          screenY = screenPos.y;
        }
      }

      const resolvedDamageKind =
        String(data?.targetKind ?? "").toUpperCase() === "PLAYER"
          ? "INCOMING_ENEMY"
          : String(data?.targetKind ?? "").toUpperCase() === "ENEMY"
            ? "OUTGOING_PLAYER"
            : fallbackKind;

      state.setFloatingDamages((prev) => [
        ...prev,
        {
          id: String(eventId ?? `${targetKey}:${Date.now()}:${Math.random()}`),
          targetId: targetKey,
          damage: exactDamage,
          kind: resolvedDamageKind,
          screenX,
          screenY,
          startedAt: Date.now(),
          ttlMs: damageTtlMs,
          isCrit: false,
        },
      ]);

      const current = state.entityVitalsRef.current.get(targetKey) ?? {};
      const currentHp = Number(current.hpCurrent ?? 0);
      const currentHpMax = Number(current.hpMax ?? 0);
      const nextHpCurrent = Number.isFinite(Number(targetHPAfter))
        ? Math.max(0, Number(targetHPAfter))
        : Math.max(0, currentHp - exactDamage);
      const nextHpMax = Number.isFinite(Number(targetHPMax)) ? Math.max(0, Number(targetHPMax)) : currentHpMax;

      if (String(data?.targetKind ?? fallbackKind).toUpperCase() === "ENEMY") {
        state.predictedEnemyVitalsRef.current.set(targetKey, {
          hpCurrent: nextHpCurrent,
          hpMax: nextHpMax,
          lastDamageTime: Date.now(),
        });
      }

      const store = worldStoreRef?.current ?? null;
      if (store?.applyDelta && String(data?.targetKind ?? fallbackKind).toUpperCase() === "ENEMY") {
        const worldEntity = store.entities?.get?.(targetKey) ?? null;
        const currentRev = Number(worldEntity?.rev ?? 0);
        store.applyDelta({
          entityId: targetKey,
          rev: Number.isFinite(currentRev) ? currentRev + 0.1 : 0.1,
          hp: nextHpCurrent,
          vitals: {
            hp: {
              current: nextHpCurrent,
              max: nextHpMax,
            },
          },
        });
      }

      state.entityVitalsRef.current.set(targetKey, {
        ...current,
        hpCurrent: nextHpCurrent,
        hpMax: nextHpMax,
        lastDamageTime: Date.now(),
      });

      const selected = state.selectedTargetRef.current;
      if (selected?.kind === "ENEMY" && String(selected.id) === targetKey) {
        const enemyName =
          state.meshByEnemyIdRef.current.get(targetKey)?.userData?.displayName ?? `Enemy ${targetKey}`;
        state.setTargetHpBar({
          id: targetKey,
          x: state.targetHpBar?.x ?? null,
          y: state.targetHpBar?.y ?? null,
          displayName: enemyName,
          hpCurrent: nextHpCurrent,
          hpMax: nextHpMax,
        });
      }
    };

    const onDamageTaken = (data) => applyDamageEvent(data, "OUTGOING_PLAYER");
    const onEnemyAttack = (data) => applyDamageEvent(data, "INCOMING_ENEMY");
    const onCombatCancelled = () => {
      state.seenDamageEventIdsRef.current.clear();
      state.setFloatingDamages([]);
      state.setTargetHpBar(null);
      state.setTargetLootCard(null);
      state.predictedEnemyVitalsRef.current.clear();
    };

    socket.on("combat:damage_taken", onDamageTaken);
    socket.on("combat:enemy_attack", onEnemyAttack);
    socket.on("combat:cancelled", onCombatCancelled);

    return () => {
      socket.off("combat:damage_taken", onDamageTaken);
      socket.off("combat:enemy_attack", onEnemyAttack);
      socket.off("combat:cancelled", onCombatCancelled);
    };
  }, [state, damageTtlMs]);
}
