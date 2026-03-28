/**
 * =====================================================================
 * ⚠️ REGRA DE OURO — COMENTÁRIO IMUTÁVEL (NÃO REMOVER)
 * =====================================================================
 * [COMENTÁRIO ORIGINAL MANTIDO - veja arquivo original]
 * =====================================================================
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { setupCamera } from "./camera/camera";
import { setupLight } from "./light/light";

import { createInputBus } from "../input/InputBus";
import { bindInputs } from "../input/inputs";
import { IntentType } from "../input/intents";

import { getSocket } from "@/services/Socket";
import { createPlayerMesh } from "../entities/character/player";
import { createActorMesh } from "../entities/actors/ActorFactory";
import { TargetMarker } from "./TargetMarker";
import { FloatingDamageText } from "./FloatingDamageText";
import { HPBar } from "./HPBar";

const COLOR_SELF = "#ff2d55";
const COLOR_OTHER = "#2d7dff";

const ENEMY_COLORS = {
  WILD_RABBIT: 0xff6b35,
  GOBLIN: 0x4ade80,
  WOLF: 0xef4444,
  DEFAULT: 0x94a3b8,
};

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getEnemyColor(displayName) {
  if (!displayName) return ENEMY_COLORS.DEFAULT;

  const name = String(displayName).toUpperCase();
  if (name.includes("RABBIT")) return ENEMY_COLORS.WILD_RABBIT;
  if (name.includes("GOBLIN")) return ENEMY_COLORS.GOBLIN;
  if (name.includes("WOLF")) return ENEMY_COLORS.WOLF;

  return ENEMY_COLORS.DEFAULT;
}

function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

function readPosYawFromRuntime(rt) {
  if (!rt) return { x: 0, y: 0, z: 0, yaw: 0 };

  const x = Number(rt.pos_x ?? rt.pos?.x ?? 0);
  const y = Number(rt.pos_y ?? rt.pos?.y ?? 0);
  const z = Number(rt.pos_z ?? rt.pos?.z ?? 0);
  const yaw = Number(rt.yaw ?? 0);

  return { x, y, z, yaw };
}

function readPosYawFromEntity(e) {
  const x = Number(e?.pos?.x ?? 0);
  const y = Number(e?.pos?.y ?? 0);
  const z = Number(e?.pos?.z ?? 0);
  const yaw = Number(e?.yaw ?? 0);
  return { x, y, z, yaw };
}

function readEntityVitals(entity) {
  const hpCurrent =
    entity?.vitals?.hp?.current ??
    entity?.hpCurrent ??
    entity?.hp_current ??
    entity?.hp ??
    0;

  const hpMax =
    entity?.vitals?.hp?.max ??
    entity?.hpMax ??
    entity?.hp_max ??
    0;

  const staminaCurrent =
    entity?.vitals?.stamina?.current ??
    entity?.staminaCurrent ??
    entity?.stamina_current ??
    0;

  const staminaMax =
    entity?.vitals?.stamina?.max ??
    entity?.staminaMax ??
    entity?.stamina_max ??
    0;

  return {
    hpCurrent: toNum(hpCurrent, 0),
    hpMax: toNum(hpMax, 0),
    staminaCurrent: toNum(staminaCurrent, 0),
    staminaMax: toNum(staminaMax, 0),
  };
}

function toWorldDir(inputDir, camYaw) {
  const fx = -Math.sin(camYaw);
  const fz = -Math.cos(camYaw);

  const rx = fz;
  const rz = -fx;

  const forwardAmount = -(inputDir.z || 0);
  const strafeAmount = inputDir.x || 0;

  const wx = rx * strafeAmount + fx * forwardAmount;
  const wz = rz * strafeAmount + fz * forwardAmount;

  return normalize2D(wx, wz);
}

function applySelfColor(mesh, isSelf) {
  if (!mesh) return;
  const color = isSelf ? COLOR_SELF : COLOR_OTHER;
  mesh.userData.isSelf = !!isSelf;

  const mat = mesh.material;
  if (Array.isArray(mat)) {
    for (const m of mat) {
      if (m?.color) m.color.set(color);
    }
  } else if (mat?.color) {
    mat.color.set(color);
  }
}

function pickTargetFromHitObject(obj) {
  let cur = obj;
  while (cur) {
    const ud = cur.userData || {};

    if (ud.actorId != null) {
      return {
        kind: "ACTOR",
        id: String(ud.actorId),
        actorType: ud.actorType ? String(ud.actorType) : null,
      };
    }

    if (ud.kind === "ENEMY" && ud.entityId != null) {
      return {
        kind: "ENEMY",
        id: String(ud.entityId),
      };
    }

    if (ud.playerId != null) {
      return {
        kind: "PLAYER",
        id: String(ud.playerId),
      };
    }

    if (ud.kind === "PLAYER" && ud.entityId != null) {
      return {
        kind: "PLAYER",
        id: String(ud.entityId),
      };
    }

    cur = cur.parent;
  }
  return null;
}

function projectWorldToScreenPx(worldPos, camera, domElement) {
  const rect = domElement.getBoundingClientRect();
  const v = worldPos.clone().project(camera);

  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || v.z < -1 || v.z > 1) {
    return null;
  }

  const x = (v.x * 0.5 + 0.5) * rect.width;
  const y = (-v.y * 0.5 + 0.5) * rect.height;

  return { x, y };
}

function isEnemyEntity(entity) {
  if (!entity) return false;
  if (entity.kind === "ENEMY") return true;

  if (!entity?.displayName) return false;
  const name = String(entity.displayName).toUpperCase();

  return (
    name.includes("RABBIT") ||
    name.includes("GOBLIN") ||
    name.includes("WOLF") ||
    name.includes("SLIME") ||
    name.includes("ORC") ||
    name.includes("SPIDER") ||
    name.startsWith("ENEMY_") ||
    name.startsWith("MONSTER_")
  );
}

export function GameCanvas({
  snapshot,
  worldStoreRef,
  onInputIntent,
  onTargetSelect,
  onTargetClear,
}) {
  const containerRef = useRef(null);

  const runtimeRef = useRef(null);
  const templateRef = useRef(null);
  const versionRef = useRef(null);
  const actorsRef = useRef([]);
  const cameraRef = useRef(null);

  const meshByEntityIdRef = useRef(new Map());
  const meshByActorIdRef = useRef(new Map());
  const meshByEnemyIdRef = useRef(new Map());

  const lastSelfIdRef = useRef(null);

  const selectedTargetRef = useRef(null);
  const selectedObjectRef = useRef(null);

  const [marker, setMarker] = useState({ visible: false, x: 0, y: 0 });
  const [floatingDamages, setFloatingDamages] = useState([]);
  const [targetHpBar, setTargetHpBar] = useState(null);

  const entityVitalsRef = useRef(new Map());
  const entityPositionsRef = useRef(new Map());
  const seenDamageEventIdsRef = useRef(new Set());

  // ✨ LOG SNAPSHOT
  useEffect(() => {
    if (snapshot) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[GAMECANVAS] 📦 SNAPSHOT RECEBIDO`);
      console.log(`${'='.repeat(80)}`);
      console.log(`[GAMECANVAS] Runtime userId=${snapshot.runtime?.user_id ?? snapshot.runtime?.userId}`);
      console.log(`[GAMECANVAS] Pos=(${snapshot.runtime?.pos?.x}, ${snapshot.runtime?.pos?.z})`);
      console.log(`[GAMECANVAS] Actors: ${snapshot.actors?.length ?? 0}`);
      
      runtimeRef.current = snapshot.runtime ?? null;
      templateRef.current = snapshot.localTemplate ?? null;
      versionRef.current = snapshot.localTemplateVersion ?? null;
      actorsRef.current = snapshot.actors ?? [];

      console.log(`[GAMECANVAS] ✅ Snapshot aplicado aos refs`);
      console.log(`${'='.repeat(80)}\n`);
    }
  }, [snapshot]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const applyDamageEvent = (data) => {
      if (!data) return;

      const { eventId, targetId, damage, targetHPAfter, targetHPMax } = data;
      if (targetId == null || damage == null) return;

      if (eventId && seenDamageEventIdsRef.current.has(String(eventId))) {
        return;
      }
      if (eventId) {
        seenDamageEventIdsRef.current.add(String(eventId));
      }

      const exactDamage = Number(damage);
      const exactDamageText = Number.isFinite(exactDamage) ? exactDamage : 0;

      const targetKey = String(targetId);
      const worldPos = entityPositionsRef.current.get(targetKey);
      let screenX = 0;
      let screenY = 0;
      if (worldPos && containerRef.current && cameraRef.current) {
        const screenPos = projectWorldToScreenPx(
          new THREE.Vector3(worldPos.x, worldPos.y + 1.2, worldPos.z),
          cameraRef.current,
          containerRef.current
        );
        if (screenPos) {
          screenX = screenPos.x;
          screenY = screenPos.y;
        }
      }

      setFloatingDamages((prev) => [
        ...prev,
        {
          id: String(eventId ?? `${String(targetId)}:${Date.now()}:${Math.random()}`),
          targetId: targetKey,
          damage: exactDamageText,
          screenX,
          screenY,
          isCrit: false,
        },
      ]);

      const current = entityVitalsRef.current.get(targetKey) ?? {
        hpCurrent: 0,
        hpMax: 0,
        staminaCurrent: 0,
        staminaMax: 0,
      };

      entityVitalsRef.current.set(targetKey, {
        ...current,
        hpCurrent:
          Number.isFinite(Number(targetHPAfter))
            ? Math.max(0, Number(targetHPAfter))
            : Math.max(0, Number((current.hpCurrent ?? 0) - exactDamageText)),
        hpMax:
          Number.isFinite(Number(targetHPMax))
            ? Math.max(0, Number(targetHPMax))
            : current.hpMax,
        lastDamageTime: Date.now(),
      });
    };

    const onDamageTaken = (data) => {
      applyDamageEvent(data);
    };

    const onAttackResult = (data) => {
      if (!data) return;
      console.log("[COMBAT] Attack result:", data);
    };

    const onEnemyAttack = (data) => {
      applyDamageEvent(data);
    };

    const onCombatCancelled = () => {
      seenDamageEventIdsRef.current.clear();
      setFloatingDamages([]);
      setTargetHpBar(null);
    };

    socket.on("combat:damage_taken", onDamageTaken);
    socket.on("combat:enemy_attack", onEnemyAttack);
    socket.on("combat:cancelled", onCombatCancelled);
    socket.on("combat:attack_result", onAttackResult);

    return () => {
      socket.off("combat:damage_taken", onDamageTaken);
      socket.off("combat:enemy_attack", onEnemyAttack);
      socket.off("combat:cancelled", onCombatCancelled);
      socket.off("combat:attack_result", onAttackResult);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tpl = templateRef.current;
    const sizeX = tpl?.geometry?.size_x ?? 100;
    const sizeZ = tpl?.geometry?.size_z ?? 100;
    const visual = tpl?.visual ?? {};

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const grid = new THREE.GridHelper(Math.max(sizeX, sizeZ), 20);
    grid.position.set(0, 0.001, 0);
    scene.add(grid);

    const axes = new THREE.AxesHelper(10);
    axes.position.set(0, 0.01, 0);
    scene.add(axes);

    const { camera, update, applyOrbit, applyZoom, onResize, setBounds, getYaw } =
      setupCamera(container);
    cameraRef.current = camera;

    setupLight(scene);

    setBounds({ sizeX, sizeZ });
    window.addEventListener("resize", onResize);

    const groundColor =
      visual?.ground_render_material?.base_color ??
      visual?.ground_color ??
      "#5a5a5a";

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(groundColor),
    });

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeX, sizeZ),
      groundMaterial
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, 0, 0);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();

    function setMouseFromClientToNdc(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      mouseNdc.x = x * 2 - 1;
      mouseNdc.y = -(y * 2 - 1);
    }

    function tryPickTarget(clientX, clientY) {
      setMouseFromClientToNdc(clientX, clientY);
      raycaster.setFromCamera(mouseNdc, camera);

      const actorMeshes = Array.from(meshByActorIdRef.current.values());
      const entityMeshes = Array.from(meshByEntityIdRef.current.values());
      const enemyMeshes = Array.from(meshByEnemyIdRef.current.values());

      const candidates = [];
      for (const m of actorMeshes) candidates.push(m);
      for (const m of enemyMeshes) candidates.push(m);
      for (const m of entityMeshes) candidates.push(m);

      if (candidates.length === 0) return null;

      const hits = raycaster.intersectObjects(candidates, true);
      if (!hits || hits.length === 0) return null;

      const hitObj = hits[0].object;
      const t = pickTargetFromHitObject(hitObj);
      if (!t) return null;

      if (t.kind === "PLAYER") {
        const store = worldStoreRef?.current ?? null;
        const selfId = store?.selfId ?? null;
        if (selfId != null && String(t.id) === String(selfId)) return null;
      }

      return { target: t, hitObject: hitObj };
    }

    function clearSelection() {
      selectedTargetRef.current = null;
      selectedObjectRef.current = null;

      setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      setTargetHpBar(null);

      onTargetClear?.();
      onInputIntent?.({ type: IntentType.TARGET_CLEAR });
    }

    function setSelection(t, obj) {
      selectedTargetRef.current = t;

      let root = obj;
      while (root?.parent && root.parent.type !== "Scene") {
        root = root.parent;
      }
      selectedObjectRef.current = root ?? obj;

      const payload = { kind: t.kind, id: String(t.id) };

      onTargetSelect?.(payload);
      onInputIntent?.({
        type: IntentType.TARGET_SELECT,
        target: payload,
      });
    }

    function emitClick(clientX, clientY, moveDir) {
      const socket = getSocket();
      if (!socket) return;

      const picked = tryPickTarget(clientX, clientY);
      if (picked?.target) {
        setSelection(picked.target, picked.hitObject);
        return;
      }

      clearSelection();

      if (!(moveDir.x === 0 && moveDir.z === 0)) return;

      setMouseFromClientToNdc(clientX, clientY);
      raycaster.setFromCamera(mouseNdc, camera);

      const hits = raycaster.intersectObject(groundMesh, false);
      if (!hits || hits.length === 0) return;

      const p = hits[0].point;
      const x = Number(p?.x);
      const z = Number(p?.z);

      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      socket.emit("move:click", { x, z });
    }

    const bus = createInputBus();
    const unbindInputs = bindInputs(renderer.domElement, bus);

    let moveDir = { x: 0, z: 0 };

    const off = bus.on((intent) => {
      if (!intent || typeof intent !== "object") return;

      if (intent.type === IntentType.UI_TOGGLE_INVENTORY) {
        onInputIntent?.(intent);
        return;
      }

      if (intent.type === IntentType.CAMERA_ZOOM) {
        applyZoom(intent.delta);
        return;
      }

      if (intent.type === IntentType.CAMERA_ORBIT) {
        applyOrbit(intent.dx, intent.dy);
        return;
      }

      if (intent.type === IntentType.MOVE_DIRECTION) {
        const raw = intent?.dir ?? { x: 0, z: 0 };
        moveDir = normalize2D(raw.x || 0, raw.z || 0);
        return;
      }

      if (intent.type === IntentType.CLICK_PRIMARY) {
        emitClick(intent.clientX, intent.clientY, moveDir);
        return;
      }

      if (
        intent.type === IntentType.INTERACT_PRESS ||
        intent.type === IntentType.INTERACT_RELEASE ||
        intent.type === IntentType.INTERACT_PRIMARY_DOWN ||
        intent.type === IntentType.INTERACT_PRIMARY_UP
      ) {
        onInputIntent?.(intent);
        return;
      }

      onInputIntent?.(intent);
    });

    const yLine = 0.2;
    const halfX = sizeX / 2;
    const halfZ = sizeZ / 2;

    const pts = [
      new THREE.Vector3(-halfX, yLine, -halfZ),
      new THREE.Vector3(halfX, yLine, -halfZ),
      new THREE.Vector3(halfX, yLine, halfZ),
      new THREE.Vector3(-halfX, yLine, halfZ),
    ];

    const boundsGeometry = new THREE.BufferGeometry().setFromPoints(pts);
    const boundsMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const bounds = new THREE.LineLoop(boundsGeometry, boundsMaterial);
    bounds.frustumCulled = false;
    scene.add(bounds);

    let alive = true;
    const clock = new THREE.Clock();

    const fallbackTarget = new THREE.Object3D();
    fallbackTarget.position.set(0, 0, 0);

    let markerAccum = 0;
    const tmpWorld = new THREE.Vector3();

      const entityPositions = entityPositionsRef.current;
      entityPositions.clear();

    // ✨ LOG: Debug frame count
    let frameCount = 0;
    let lastEnemyLogFrame = -100;
    const LOG_ENEMY_EVERY_N_FRAMES = 60; // Log a cada ~1 segundo em 60 FPS

    const tick = () => {
      if (!alive) return;

      frameCount++;
      const dt = Math.min(clock.getDelta(), 0.05);
      markerAccum += dt;

      const socket = getSocket();
      if (socket) {
        const camYaw = getYaw();
        const dirWorld = toWorldDir(moveDir, camYaw);

        socket.emit("move:intent", {
          dir: dirWorld,
          dt,
          yawDesired: camYaw,
        });
      }

      const actors = actorsRef.current ?? [];
      const nextActorIds = new Set();

      for (const actor of actors) {
        const actorId = String(actor.id);
        nextActorIds.add(actorId);

        let mesh = meshByActorIdRef.current.get(actorId);
        if (!mesh) {
          mesh = createActorMesh(actor);

          mesh.userData.kind = mesh.userData.kind ?? "ACTOR";
          mesh.userData.actorId = mesh.userData.actorId ?? actorId;
          mesh.userData.actorType =
            mesh.userData.actorType ?? actor.actorType ?? actor.actor_type ?? null;

          meshByActorIdRef.current.set(actorId, mesh);
          scene.add(mesh);
        }

        const { x, y, z, yaw } = readPosYawFromEntity(actor);
        mesh.position.set(x, y ?? 0, z);
        mesh.rotation.y = yaw ?? 0;
      }

      for (const [actorId, mesh] of meshByActorIdRef.current.entries()) {
        if (nextActorIds.has(actorId)) continue;

        const sel = selectedTargetRef.current;
        if (sel?.kind === "ACTOR" && String(sel.id) === String(actorId)) {
          clearSelection();
        }

        scene.remove(mesh);
        try {
          mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        } catch {}
        meshByActorIdRef.current.delete(actorId);
      }

      const store = worldStoreRef?.current ?? null;
      const entities = store?.getSnapshot?.() ?? null;
      const selfId = store?.selfId ?? null;

      if (Array.isArray(entities) && entities.length > 0) {
        const selfKey = selfId == null ? null : String(selfId);
        const nextEnemyIds = new Set();

        const enemies = entities.filter((e) => {
          const eid = String(e?.entityId ?? "");
          if (eid === selfKey) return false;
          return isEnemyEntity(e);
        });

        for (const enemy of enemies) {
          const enemyId = String(enemy.entityId);
          nextEnemyIds.add(enemyId);

          const posX = enemy.pos?.x ?? 0;
          const posZ = enemy.pos?.z ?? 0;
          entityPositions.set(enemyId, {
            x: posX,
            y: enemy.pos?.y ?? 0.5,
            z: posZ,
          });

          let mesh = meshByEnemyIdRef.current.get(enemyId);
          if (!mesh) {
            const color = getEnemyColor(enemy.displayName);
            const geometry = new THREE.SphereGeometry(0.5, 16, 16);
            const material = new THREE.MeshStandardMaterial({
              color,
              metalness: 0.3,
              roughness: 0.6,
            });

            mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = false;

            mesh.userData.kind = "ENEMY";
            mesh.userData.entityId = enemyId;
            mesh.userData.displayName = enemy.displayName;

            meshByEnemyIdRef.current.set(enemyId, mesh);
            scene.add(mesh);

            console.log(`[ENEMY_CREATE] 🎯 id=${enemyId} name=${enemy.displayName} raw_pos=(${posX}, ${posZ})`);
          }

          const { x, z, yaw } = readPosYawFromEntity(enemy);

          mesh.position.set(x, 0.5, z);
          mesh.rotation.y = yaw;

          const vitals = readEntityVitals(enemy);
          const prev = entityVitalsRef.current.get(enemyId) ?? {};

          entityVitalsRef.current.set(enemyId, {
            ...prev,
            ...vitals,
          });
        }

        for (const [enemyId, mesh] of meshByEnemyIdRef.current.entries()) {
          if (nextEnemyIds.has(enemyId)) continue;

          const sel = selectedTargetRef.current;
          if (sel?.kind === "ENEMY" && String(sel.id) === String(enemyId)) {
            clearSelection();
          }

          scene.remove(mesh);
          try {
            mesh.geometry?.dispose?.();
          } catch {}
          try {
            mesh.material?.dispose?.();
          } catch {}

          meshByEnemyIdRef.current.delete(enemyId);
          entityVitalsRef.current.delete(enemyId);
          entityPositions.delete(enemyId);
        }

        if (lastSelfIdRef.current !== selfKey) {
          for (const [id, mesh] of meshByEntityIdRef.current.entries()) {
            const isSelf = selfKey != null && id === selfKey;
            applySelfColor(mesh, isSelf);
          }
          lastSelfIdRef.current = selfKey;
        }

        const nextIds = new Set();

        for (const e of entities) {
          const entityIdRaw = e?.entityId;
          if (entityIdRaw == null) continue;

          const entityId = String(entityIdRaw);
          if (isEnemyEntity(e)) continue;

          nextIds.add(entityId);

          const posX = e.pos?.x ?? 0;
          const posZ = e.pos?.z ?? 0;

          entityPositions.set(entityId, {
            x: posX,
            y: e.pos?.y ?? 0,
            z: posZ,
          });

          const vitals = readEntityVitals(e);
          const prev = entityVitalsRef.current.get(entityId) ?? {};
          entityVitalsRef.current.set(entityId, {
            ...prev,
            ...vitals,
          });

          let mesh = meshByEntityIdRef.current.get(entityId);
          if (!mesh) {
            mesh = createPlayerMesh({ isSelf: selfKey != null && entityId === selfKey });

            mesh.userData.kind = "PLAYER";
            mesh.userData.entityId = entityId;

            meshByEntityIdRef.current.set(entityId, mesh);
            scene.add(mesh);

            console.log(`[PLAYER_CREATE] 👤 id=${entityId} self=${selfKey === entityId} pos=(${posX.toFixed(2)}, ${posZ.toFixed(2)})`);
          }

          const isSelfNow = selfKey != null && entityId === selfKey;
          if (mesh.userData?.isSelf !== isSelfNow) {
            applySelfColor(mesh, isSelfNow);
          }

          const { x, y, z, yaw } = readPosYawFromEntity(e);
          mesh.position.set(x, y ?? 0, z);
          mesh.rotation.y = yaw;
        }

        for (const [entityId, mesh] of meshByEntityIdRef.current.entries()) {
          if (nextIds.has(entityId)) continue;

          const sel = selectedTargetRef.current;
          if (sel?.kind === "PLAYER" && String(sel.id) === String(entityId)) {
            clearSelection();
          }

          scene.remove(mesh);
          try {
            mesh.geometry?.dispose?.();
          } catch {}
          try {
            if (Array.isArray(mesh.material)) {
              for (const m of mesh.material) m?.dispose?.();
            } else {
              mesh.material?.dispose?.();
            }
          } catch {}

          meshByEntityIdRef.current.delete(entityId);
          entityVitalsRef.current.delete(entityId);
          entityPositions.delete(entityId);
        }

        const heroMesh = selfKey ? meshByEntityIdRef.current.get(selfKey) : null;
        if (heroMesh) {
          update(heroMesh, dt);
        } else {
          update(fallbackTarget, dt);
        }
      } else {
        const rt = runtimeRef.current;
        if (rt) {
          const { x, y, z, yaw } = readPosYawFromRuntime(rt);

          const legacyId = "__legacy_self__";
          let mesh = meshByEntityIdRef.current.get(legacyId);
          if (!mesh) {
            mesh = createPlayerMesh({ isSelf: true });

            mesh.userData.kind = "PLAYER";
            mesh.userData.entityId = legacyId;

            meshByEntityIdRef.current.set(legacyId, mesh);
            scene.add(mesh);

            console.log(`[PLAYER_FALLBACK] pos=(${x.toFixed(2)}, ${z.toFixed(2)})`);
          }

          mesh.position.set(x, y ?? 0, z);
          mesh.rotation.y = yaw;

          update(mesh, dt);
        } else {
          update(fallbackTarget, dt);
        }
      }

      if (markerAccum >= 0.05) {
        markerAccum = 0;

        const obj = selectedObjectRef.current;
        if (!obj) {
          setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        } else {
          obj.getWorldPosition(tmpWorld);
          tmpWorld.y += 0.9;

          const screen = projectWorldToScreenPx(tmpWorld, camera, renderer.domElement);
          if (!screen) {
            setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          } else {
            setMarker({ visible: true, x: screen.x, y: screen.y });
          }
        }

        setFloatingDamages((prev) =>
          prev.map((dmg) => {
            const pos = entityPositions.get(dmg.targetId);
            if (!pos) return dmg;

            const screenPos = projectWorldToScreenPx(
              new THREE.Vector3(pos.x, pos.y + 1.2, pos.z),
              camera,
              renderer.domElement
            );

            return {
              ...dmg,
              screenX: screenPos?.x ?? dmg.screenX,
              screenY: screenPos?.y ?? dmg.screenY,
            };
          })
        );

        const selected = selectedTargetRef.current;
        if (selected?.kind === "ENEMY") {
          const pos = entityPositions.get(String(selected.id));
          const vitals = entityVitalsRef.current.get(String(selected.id));

          if (!pos || !vitals || Number(vitals.hpMax ?? 0) <= 0) {
            setTargetHpBar(null);
          } else {
            const screenPos = projectWorldToScreenPx(
              new THREE.Vector3(pos.x, pos.y + 0.95, pos.z),
              camera,
              renderer.domElement
            );

            if (!screenPos) {
              setTargetHpBar(null);
            } else {
              setTargetHpBar({
                id: String(selected.id),
                x: screenPos.x,
                y: screenPos.y,
                hpCurrent: Math.max(0, vitals.hpCurrent ?? 0),
                hpMax: vitals.hpMax ?? 0,
              });
            }
          }
        } else {
          setTargetHpBar(null);
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    return () => {
      alive = false;

      off();
      unbindInputs();
      window.removeEventListener("resize", onResize);

      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      for (const [, mesh] of meshByEntityIdRef.current.entries()) {
        scene.remove(mesh);
        try {
          mesh.geometry?.dispose?.();
        } catch {}
        try {
          if (Array.isArray(mesh.material)) {
            for (const m of mesh.material) m?.dispose?.();
          } else {
            mesh.material?.dispose?.();
          }
        } catch {}
      }
      meshByEntityIdRef.current.clear();

      for (const [, mesh] of meshByEnemyIdRef.current.entries()) {
        scene.remove(mesh);
        try {
          mesh.geometry?.dispose?.();
        } catch {}
        try {
          mesh.material?.dispose?.();
        } catch {}
      }
      meshByEnemyIdRef.current.clear();

      for (const [, mesh] of meshByActorIdRef.current.entries()) {
        scene.remove(mesh);
        try {
          mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        } catch {}
      }
      meshByActorIdRef.current.clear();

      scene.remove(grid);
      scene.remove(axes);

      renderer.dispose();

      groundMesh.geometry.dispose();
      groundMesh.material.dispose();

      boundsGeometry.dispose();
      boundsMaterial.dispose();

      selectedTargetRef.current = null;
      selectedObjectRef.current = null;
      entityVitalsRef.current.clear();
      entityPositionsRef.current.clear();
      seenDamageEventIdsRef.current.clear();
      cameraRef.current = null;

      setMarker({ visible: false, x: 0, y: 0 });
      setTargetHpBar(null);
    };
  }, [onInputIntent, onTargetSelect, onTargetClear, worldStoreRef]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <TargetMarker visible={marker.visible} x={marker.x} y={marker.y} />

      <FloatingDamageText damages={floatingDamages} />

      {targetHpBar ? (
        <HPBar
          visible={true}
          x={targetHpBar.x}
          y={targetHpBar.y}
          hpCurrent={targetHpBar.hpCurrent}
          hpMax={targetHpBar.hpMax}
          mode="world"
          width={70}
          hpHeight={8}
          showHpText={true}
          showStamina={false}
        />
      ) : null}
    </div>
  );
}
