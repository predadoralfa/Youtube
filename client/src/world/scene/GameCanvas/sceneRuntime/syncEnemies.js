import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getEnemyColor, isEnemyEntity, readEntityVitals, readPosYawFromEntity } from "../helpers";
import { sampleGroundTilt } from "./terrain";

const rabbitModelUrl = new URL("../../../../assets/Rabbit.glb", import.meta.url).href;
const rabbitLoader = new GLTFLoader();
let rabbitTemplatePromise = null;
let rabbitTemplateScene = null;

function normalizeEnemyAssetKey(enemy) {
  const raw = String(enemy?.assetKey ?? enemy?.visualKind ?? "").trim().toUpperCase();
  if (raw === "RABBIT") return "RABBIT";

  const token = String(
    enemy?.displayName ?? enemy?.enemyDefName ?? enemy?.enemyDefCode ?? ""
  ).trim().toUpperCase();
  if (token.includes("RABBIT") || token.includes("COELHO")) return "RABBIT";

  return null;
}

function resolveEnemyVisualScale(enemy) {
  const explicit = Number(enemy?.visualScale ?? enemy?.visual_scale ?? 1);
  return Number.isFinite(explicit) && explicit > 0 ? explicit : 1;
}

async function loadRabbitTemplate() {
  if (rabbitTemplateScene) return rabbitTemplateScene;

  if (!rabbitTemplatePromise) {
    rabbitTemplatePromise = rabbitLoader.loadAsync(rabbitModelUrl)
      .then((gltf) => {
        rabbitTemplateScene = gltf.scene;
        return rabbitTemplateScene;
      })
      .catch((error) => {
        rabbitTemplatePromise = null;
        throw error;
      });
  }

  return rabbitTemplatePromise;
}

function alignModelToGround(model) {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

function applyMeshMetadata(mesh, enemyId, enemy) {
  mesh.userData.kind = "ENEMY";
  mesh.userData.entityId = enemyId;
  mesh.userData.displayName = enemy.displayName ?? null;
  mesh.userData.assetKey = enemy.assetKey ?? null;
}

function createFallbackEnemyMesh(enemyId, enemy) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshStandardMaterial({
      color: getEnemyColor(enemy.displayName),
      metalness: 0.3,
      roughness: 0.6,
    })
  );
  mesh.castShadow = true;
  applyMeshMetadata(mesh, enemyId, enemy);
  const visualScale = resolveEnemyVisualScale(enemy);
  mesh.userData.visualScale = visualScale;
  mesh.userData.baseVisualScale = visualScale;
  mesh.userData.groundAnchor = visualScale * 0.5;
  mesh.scale.setScalar(visualScale);
  return mesh;
}

function createRabbitGroup(template, enemyId, enemy) {
  const group = new THREE.Group();
  const model = template.clone(true);
  const visualScale = resolveEnemyVisualScale(enemy);
  model.scale.setScalar(1);
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  alignModelToGround(model);
  group.add(model);
  applyMeshMetadata(group, enemyId, enemy);
  group.userData.visualScale = visualScale;
  group.userData.baseVisualScale = visualScale;
  group.userData.groundAnchor = 0;
  group.userData.rabbitModelNode = model;
  group.userData.rabbitBaseModelPos = {
    x: model.position.x,
    y: model.position.y,
    z: model.position.z,
  };
  return group;
}

function applyEnemyMotion(mesh, enemy, nowMs) {
  if (!mesh) return;

  const action = String(enemy?.action ?? "idle").trim().toLowerCase() || "idle";
  const motion = mesh.userData.motionState ?? {
    action,
    startedAtMs: nowMs,
    lastUpdateAtMs: nowMs,
  };

  if (motion.action !== action) {
    motion.action = action;
    motion.startedAtMs = nowMs;
  }
  motion.lastUpdateAtMs = nowMs;
  mesh.userData.motionState = motion;

  const elapsed = Math.max(0, nowMs - motion.startedAtMs);
  let bob = 0.02;
  let leanX = 0;
  let rollZ = 0;
  let squash = 1;
  let lungeZ = 0;

  if (action === "move") {
    const phase = elapsed / 95;
    const hop = Math.abs(Math.sin(phase));
    bob = 0.08 + hop * 0.12;
    leanX = -0.05 * hop;
    rollZ = Math.sin(phase * 1.35) * 0.03;
    squash = 1 + hop * 0.03;
  } else if (action === "attack") {
    const t = Math.min(1, elapsed / 260);
    const pulse = Math.sin(Math.PI * t);
    bob = 0.06 + pulse * 0.22;
    leanX = -0.22 * pulse;
    rollZ = Math.sin(Math.PI * t) * 0.05;
    squash = 1 - pulse * 0.08;
    lungeZ = -0.14 * pulse;
  } else {
    const breathe = Math.sin(elapsed / 260) * 0.01;
    bob = 0.02 + breathe;
    leanX = 0;
    rollZ = 0;
    squash = 1;
  }

  const baseGroundY = Number(mesh.userData.baseGroundY ?? mesh.position.y ?? 0);
  const groundTilt = mesh.userData.groundTilt ?? { pitch: 0, roll: 0 };
  mesh.position.y = baseGroundY + bob;
  mesh.rotation.x = groundTilt.pitch + leanX;
  mesh.rotation.z = groundTilt.roll + rollZ;
  mesh.scale.setScalar((mesh.userData.baseVisualScale ?? mesh.userData.visualScale ?? 1) * squash);

  const rabbitModelNode = mesh.userData.rabbitModelNode ?? null;
  if (rabbitModelNode) {
    const base = mesh.userData.rabbitBaseModelPos ?? {
      x: rabbitModelNode.position.x,
      y: rabbitModelNode.position.y,
      z: rabbitModelNode.position.z,
    };
    mesh.userData.rabbitBaseModelPos = base;
    rabbitModelNode.position.set(base.x, base.y, base.z + lungeZ);
  }
}

export function syncEnemyMeshes({
  entities,
  selfKey,
  scene,
  state,
  clearSelection,
  entityPositions,
  sampleGroundHeight,
}) {
  const nowMs = performance.now();
  const nextEnemyIds = new Set();
  const enemies = entities.filter((entity) => {
    const entityId = String(entity?.entityId ?? "");
    if (entityId === selfKey) return false;
    return isEnemyEntity(entity);
  });

  for (const enemy of enemies) {
    const enemyId = String(enemy.entityId);
    const desiredAssetKey = normalizeEnemyAssetKey(enemy);
    const desiredVisualScale = resolveEnemyVisualScale(enemy);
    nextEnemyIds.add(enemyId);

    const groundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(enemy.pos?.x ?? 0, enemy.pos?.z ?? 0) : 0);

    entityPositions.set(enemyId, {
      x: enemy.pos?.x ?? 0,
      y: groundY,
      z: enemy.pos?.z ?? 0,
    });

    let mesh = state.meshByEnemyIdRef.current.get(enemyId);
    const currentAssetKey = String(mesh?.userData?.assetKey ?? "").trim().toUpperCase() || null;
    const currentVisualScale = Number(mesh?.userData?.visualScale ?? 1);
    const scaleChanged = Math.abs(currentVisualScale - desiredVisualScale) > 0.0005;

    if (!mesh || currentAssetKey !== desiredAssetKey || scaleChanged) {
      if (mesh) {
        scene.remove(mesh);
        state.meshByEnemyIdRef.current.delete(enemyId);
      }

      mesh = createFallbackEnemyMesh(enemyId, enemy);
      mesh.userData.assetKey = desiredAssetKey;
      mesh.userData.visualScale = desiredVisualScale;
      state.meshByEnemyIdRef.current.set(enemyId, mesh);
      scene.add(mesh);

      if (desiredAssetKey === "RABBIT") {
        loadRabbitTemplate()
          .then((template) => {
            const current = state.meshByEnemyIdRef.current.get(enemyId);
            if (!current || current.userData.assetKey !== "RABBIT") return;
            const currentScale = Number(current.userData.visualScale ?? 1);
            if (Math.abs(currentScale - desiredVisualScale) > 0.0005) return;

            const rabbitGroup = createRabbitGroup(template, enemyId, enemy);
            rabbitGroup.userData.assetKey = "RABBIT";
            rabbitGroup.userData.visualScale = desiredVisualScale;
            scene.remove(current);
            state.meshByEnemyIdRef.current.set(enemyId, rabbitGroup);
            scene.add(rabbitGroup);
          })
          .catch((error) => {
            console.error("[GAMECANVAS] Failed to load rabbit enemy model:", error);
          });
      }
    }

    mesh = state.meshByEnemyIdRef.current.get(enemyId) ?? mesh;

    if (mesh.material?.color) {
      mesh.material.color.set(getEnemyColor(enemy.displayName));
    }
    mesh.userData.displayName = enemy.displayName ?? mesh.userData.displayName ?? null;
    mesh.userData.visualScale = desiredVisualScale;

    const { x, z, yaw } = readPosYawFromEntity(enemy);
    const renderGroundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(x, z) : 0);
    const groundTilt = sampleGroundTilt(sampleGroundHeight, x, z);
    const groundAnchor = Number(mesh.userData?.groundAnchor ?? 0);
    const baseGroundY = renderGroundY + groundAnchor;
    mesh.position.set(x, baseGroundY, z);
    mesh.userData.baseGroundY = baseGroundY;
    mesh.userData.groundTilt = groundTilt;
    mesh.rotation.y = yaw;

    const vitals = readEntityVitals(enemy);
    const previous = state.entityVitalsRef.current.get(enemyId) ?? {};
    const previousHp = Number(previous.hpCurrent ?? NaN);
    const nextHp = Number(vitals.hpCurrent ?? NaN);
    const hpCurrent =
      Number.isFinite(previousHp) && Number.isFinite(nextHp) ? Math.min(previousHp, nextHp) : vitals.hpCurrent;

    state.entityVitalsRef.current.set(enemyId, {
      ...previous,
      ...vitals,
      hpCurrent,
    });
    state.predictedEnemyVitalsRef.current.set(enemyId, {
      hpCurrent: Math.max(0, hpCurrent),
      hpMax: Number(vitals.hpMax ?? previous.hpMax ?? 0),
      lastDamageTime: previous.lastDamageTime ?? null,
    });
    applyEnemyMotion(mesh, enemy, nowMs);
  }

  for (const [enemyId, mesh] of state.meshByEnemyIdRef.current.entries()) {
    if (nextEnemyIds.has(enemyId)) continue;

    const selected = state.selectedTargetRef.current;
    if (selected?.kind === "ENEMY" && String(selected.id) === String(enemyId)) {
      clearSelection();
    }

    scene.remove(mesh);
    try {
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
    } catch {}

    state.meshByEnemyIdRef.current.delete(enemyId);
    state.entityVitalsRef.current.delete(enemyId);
    state.predictedEnemyVitalsRef.current.delete(enemyId);
    entityPositions.delete(enemyId);
  }
}
