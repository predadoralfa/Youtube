import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getEnemyColor, isEnemyEntity, readEntityVitals, readPosYawFromEntity } from "../helpers";

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
  return mesh;
}

function createRabbitGroup(template, enemyId, enemy) {
  const group = new THREE.Group();
  const model = template.clone(true);
  model.scale.setScalar(4.2);
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
  return group;
}

export function syncEnemyMeshes({ entities, selfKey, scene, state, clearSelection, entityPositions }) {
  const nextEnemyIds = new Set();
  const enemies = entities.filter((entity) => {
    const entityId = String(entity?.entityId ?? "");
    if (entityId === selfKey) return false;
    return isEnemyEntity(entity);
  });

  for (const enemy of enemies) {
    const enemyId = String(enemy.entityId);
    const desiredAssetKey = normalizeEnemyAssetKey(enemy);
    nextEnemyIds.add(enemyId);

    entityPositions.set(enemyId, {
      x: enemy.pos?.x ?? 0,
      y: enemy.pos?.y ?? 0.5,
      z: enemy.pos?.z ?? 0,
    });

    let mesh = state.meshByEnemyIdRef.current.get(enemyId);
    const currentAssetKey = String(mesh?.userData?.assetKey ?? "").trim().toUpperCase() || null;

    if (!mesh || currentAssetKey !== desiredAssetKey) {
      if (mesh) {
        scene.remove(mesh);
        state.meshByEnemyIdRef.current.delete(enemyId);
      }

      mesh = createFallbackEnemyMesh(enemyId, enemy);
      mesh.userData.assetKey = desiredAssetKey;
      state.meshByEnemyIdRef.current.set(enemyId, mesh);
      scene.add(mesh);

      if (desiredAssetKey === "RABBIT") {
        loadRabbitTemplate()
          .then((template) => {
            const current = state.meshByEnemyIdRef.current.get(enemyId);
            if (!current || current.userData.assetKey !== "RABBIT") return;

            const rabbitGroup = createRabbitGroup(template, enemyId, enemy);
            rabbitGroup.userData.assetKey = "RABBIT";
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

    const { x, z, yaw } = readPosYawFromEntity(enemy);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;

    const vitals = readEntityVitals(enemy);
    const previous = state.entityVitalsRef.current.get(enemyId) ?? {};
    state.entityVitalsRef.current.set(enemyId, { ...previous, ...vitals });
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
    entityPositions.delete(enemyId);
  }
}
