import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const manModelUrl = new URL("../../../assets/Man.glb", import.meta.url).href;
const manLoader = new GLTFLoader();
const MAN_DEBUG_STORAGE_KEY = "debug-man-model";

const MAN_ANIMATION_CATALOG = {
  idle: ["CharacterArmature|Idle", "CharacterArmature|Idle_Neutral"],
  idleGun: ["CharacterArmature|Idle_Gun"],
  idleGunPointing: ["CharacterArmature|Idle_Gun_Pointing"],
  idleGunShoot: ["CharacterArmature|Idle_Gun_Shoot"],
  idleSword: ["CharacterArmature|Idle_Sword"],
  walk: ["CharacterArmature|Walk"],
  walkForward: ["CharacterArmature|Walk"],
  walkBackward: ["CharacterArmature|Run_Back"],
  walkLeft: ["CharacterArmature|Run_Left"],
  walkRight: ["CharacterArmature|Run_Right"],
  run: ["CharacterArmature|Run"],
  runForward: ["CharacterArmature|Run"],
  runBackward: ["CharacterArmature|Run_Back"],
  runLeft: ["CharacterArmature|Run_Left"],
  runRight: ["CharacterArmature|Run_Right"],
  sideLeft: ["CharacterArmature|Run_Right"],
  sideRight: ["CharacterArmature|Run_Left"],
  attack: [
    "CharacterArmature|Punch_Right",
    "CharacterArmature|Punch_Left",
    "CharacterArmature|Sword_Slash",
    "CharacterArmature|Kick_Right",
    "CharacterArmature|Kick_Left",
  ],
  hit: ["CharacterArmature|HitRecieve", "CharacterArmature|HitRecieve_2"],
  interactive: ["CharacterArmature|Interact"],
  wave: ["CharacterArmature|Wave"],
  roll: ["CharacterArmature|Roll"],
  death: ["CharacterArmature|Death"],
  gunShoot: ["CharacterArmature|Gun_Shoot"],
  runShoot: ["CharacterArmature|Run_Shoot"],
  swordSlash: ["CharacterArmature|Sword_Slash"],
  punchLeft: ["CharacterArmature|Punch_Left"],
  punchRight: ["CharacterArmature|Punch_Right"],
  kickLeft: ["CharacterArmature|Kick_Left"],
  kickRight: ["CharacterArmature|Kick_Right"],
  clap: ["CharacterArmature|Wave", "CharacterArmature|Interact"],
  standing: ["CharacterArmature|Idle_Neutral", "CharacterArmature|Idle"],
  sitting: [],
  jump: [],
  runningJump: [],
};

let manTemplatePromise = null;
let manTemplate = null;

function cloneScene(template) {
  if (!template) return null;
  return SkeletonUtils.clone(template);
}

function isManDebugEnabled() {
  try {
    return localStorage.getItem(MAN_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function logManDebug(tag, payload) {
  if (!isManDebugEnabled()) return;
  console.log(`[MAN_MODEL] ${tag}`, payload);
}

function describeBox(box) {
  if (!box || box.isEmpty?.()) return null;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return {
    min: box.min.toArray(),
    max: box.max.toArray(),
    size: size.toArray(),
    center: center.toArray(),
  };
}

function alignModelToGround(model) {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return false;

  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.y -= box.min.y;
  model.position.z -= center.z;
  return true;
}

function stabilizeModelVisibility(model) {
  let meshCount = 0;
  model.traverse((child) => {
    child.visible = true;
    if (!child.isMesh) return;
    meshCount += 1;
    child.frustumCulled = false;
    if (Array.isArray(child.material)) {
      for (const material of child.material) {
        if (!material) continue;
        material.visible = true;
        material.transparent = false;
        material.opacity = 1;
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      }
      return;
    }
    if (child.material) {
      child.material.visible = true;
      child.material.transparent = false;
      child.material.opacity = 1;
      child.material.side = THREE.DoubleSide;
      child.material.needsUpdate = true;
    }
  });

  return meshCount;
}

function normalizeModelScale(model, targetHeight = 1.8) {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return 1;

  const size = new THREE.Vector3();
  box.getSize(size);
  const height = Number(size.y);
  if (!Number.isFinite(height) || height <= 0) return 1;

  const scale = targetHeight / height;
  if (!Number.isFinite(scale) || scale <= 0) return 1;

  model.scale.multiplyScalar(scale);
  return scale;
}

function attachDebugHelpers(root) {
  if (!isManDebugEnabled() || !root) return null;

  const helperGroup = new THREE.Group();
  helperGroup.name = "ManDebugHelpers";

  const boxHelper = new THREE.BoxHelper(root, 0x00ff88);
  boxHelper.name = "ManDebugBoxHelper";
  helperGroup.add(boxHelper);

  const axes = new THREE.AxesHelper(1.5);
  axes.name = "ManDebugAxes";
  helperGroup.add(axes);

  root.add(helperGroup);
  return helperGroup;
}

function createFallbackManMesh(color = 0xff3b7f) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.98, 4, 8),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0.02,
    })
  );
  body.castShadow = true;
  body.receiveShadow = false;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xf8d2b8,
      roughness: 0.75,
      metalness: 0.0,
    })
  );
  head.castShadow = true;
  head.receiveShadow = false;
  head.position.set(0, 0.98, 0);
  group.add(head);

  group.userData.groundAnchor = 0;
  return group;
}

export async function loadManTemplate() {
  if (manTemplate) {
    return manTemplate;
  }

  if (!manTemplatePromise) {
    manTemplatePromise = manLoader
      .loadAsync(manModelUrl)
      .then((gltf) => {
        manTemplate = {
          scene: gltf.scene,
          animations: gltf.animations ?? [],
        };
        logManDebug("template-loaded", {
          animationNames: (gltf.animations ?? []).map((clip) => clip?.name ?? ""),
          sceneChildren: gltf.scene?.children?.map((child) => child?.name ?? child?.type ?? "") ?? [],
          rootBounds: describeBox(new THREE.Box3().setFromObject(gltf.scene)),
        });
        return manTemplate;
      })
      .catch((error) => {
        manTemplatePromise = null;
        throw error;
      });
  }

  return manTemplatePromise;
}

function matchClip(animations, spec) {
  const list = Array.isArray(animations) ? animations : [];
  for (const clip of list) {
    const name = String(clip?.name ?? "");
    if (!name) continue;
    for (const candidate of Array.isArray(spec) ? spec : [spec]) {
      if (typeof candidate === "string" && name === candidate) {
        return clip;
      }
      if (candidate instanceof RegExp && candidate.test(name)) {
        return clip;
      }
    }
  }

  return null;
}

function makeActionMap(mixer, animations) {
  const actionMap = new Map();

  for (const [key, clipName] of Object.entries(MAN_ANIMATION_CATALOG)) {
    const clip = matchClip(animations, clipName);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.setLoop(key === "attack" || key === "death" || key === "jump" || key === "runningJump"
      ? THREE.LoopOnce
      : THREE.LoopRepeat,
    key === "attack" || key === "death" || key === "jump" || key === "runningJump"
      ? 1
      : Infinity);
    action.clampWhenFinished = key === "attack" || key === "death" || key === "jump" || key === "runningJump";
    action.enabled = true;
    actionMap.set(key, action);
  }

  return actionMap;
}

function getMotionYawOffset(key) {
  if (key === "sideLeft") return Math.PI / 2;
  if (key === "sideRight") return -Math.PI / 2;
  return 0;
}

function ensureAnimationState(mesh, modelRoot, animations) {
  if (mesh.userData.manAnimationState) {
    return mesh.userData.manAnimationState;
  }

  const mixer = new THREE.AnimationMixer(modelRoot);
  const actions = makeActionMap(mixer, animations);
  const state = {
    mixer,
    actions,
    currentKey: null,
    lastUpdateAtMs: performance.now(),
    lastAttackAtMs: 0,
  };

  mesh.userData.manAnimationState = state;
  return state;
}

function getMoveSpeed(entity, runtime) {
  const movement = entity?.movement ?? null;
  const candidates = [
    movement?.effectiveMoveSpeed,
    movement?.speed,
    runtime?.effectiveMoveSpeed,
    runtime?.speed,
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

function resolveMotionKey(entity, runtime) {
  const hpCurrent = Number(entity?.vitals?.hp?.current ?? entity?.hp ?? 0);
  if (hpCurrent <= 0) {
    return "death";
  }

  const now = Date.now();
  const attackAtMs = Number(runtime?.combat?.lastAttackAtMs ?? 0);
  if (Number.isFinite(attackAtMs) && attackAtMs > 0 && now - attackAtMs < 650) {
    return "attack";
  }

  const hitAtMs = Number(runtime?.combat?.lastHitAtMs ?? 0);
  if (Number.isFinite(hitAtMs) && hitAtMs > 0 && now - hitAtMs < 450) {
    return "hit";
  }

  const interact = runtime?.interact ?? null;
  if (
    interact?.active &&
    String(interact?.kind ?? "").toUpperCase() === "ACTOR" &&
    String(interact?.phase ?? "").toUpperCase() === "COLLECTING"
  ) {
    return "interactive";
  }

  const action = String(entity?.action ?? "idle").toLowerCase();
  if (action !== "move") {
    return "idle";
  }

  const movementVisual = runtime?.movementVisual ?? null;
  const localDir = movementVisual?.localDir ?? movementVisual?.inputDir ?? null;
  const speed = getMoveSpeed(entity, runtime);
  const isWasdMovement = String(movementVisual?.mode ?? "").toUpperCase() === "WASD";
  const isRunning = isWasdMovement ? true : speed >= 4.5;

  if (localDir && (Number(localDir.x ?? 0) !== 0 || Number(localDir.z ?? 0) !== 0)) {
    if (isWasdMovement) {
      if (Number(localDir.x ?? 0) !== 0 && Number(localDir.z ?? 0) !== 0) {
        return Number(localDir.z ?? 0) < 0 ? "runForward" : "runBackward";
      }
      if (Number(localDir.x ?? 0) !== 0) {
        return Number(localDir.x ?? 0) < 0 ? "sideLeft" : "sideRight";
      }
      return Number(localDir.z ?? 0) < 0 ? "runForward" : "runBackward";
    }
    const ax = Math.abs(Number(localDir.x ?? 0));
    const az = Math.abs(Number(localDir.z ?? 0));
    if (az >= ax) {
      return Number(localDir.z ?? 0) < 0
        ? isRunning
          ? "runForward"
          : "walkForward"
        : isRunning
          ? "runBackward"
          : "walkBackward";
    }
    return Number(localDir.x ?? 0) < 0
      ? isRunning
        ? "runLeft"
        : "walkLeft"
      : isRunning
        ? "runRight"
        : "walkRight";
  }

  return isRunning ? "run" : "walk";
}

function startAction(state, key) {
  if (!state || !key) return;

  const fallbackKey =
    key === "walkForward" || key === "walkBackward" || key === "walkLeft" || key === "walkRight"
      ? "walk"
      : key === "runForward" || key === "runBackward" || key === "runLeft" || key === "runRight"
        ? "run"
      : key === "attack" || key === "hit"
          ? "standing"
        : key === "interactive"
          ? "clap"
          : key;
  const nextAction = state.actions.get(key) ?? state.actions.get(fallbackKey);
  if (!nextAction) return;

  if (state.currentKey === key) {
    if (!nextAction.isRunning()) {
      nextAction.reset().play();
    }
    return;
  }

  const prevAction = state.currentKey ? state.actions.get(state.currentKey) : null;
  if (prevAction) {
    prevAction.fadeOut(0.12);
  }

  nextAction.reset();
  nextAction.fadeIn(0.12);
  nextAction.play();
  state.currentKey = key;
}

export function createPlayerMesh({ isSelf = true } = {}) {
  const group = new THREE.Group();
  group.userData.isSelf = !!isSelf;
  group.userData.groundAnchor = 0;
  group.userData.manTemplateLoaded = false;
  group.frustumCulled = false;

  const fallback = createFallbackManMesh(isSelf ? 0xff3b7f : 0x6db6ff);
  fallback.name = "ManFallback";
  group.add(fallback);

  loadManTemplate()
    .then(({ scene: templateScene, animations }) => {
      if (!group || group.userData.manDisposed) return;

      const modelRoot = cloneScene(templateScene);
      if (!modelRoot) return;

      modelRoot.name = "ManModel";
      modelRoot.scale.setScalar(1);
      modelRoot.position.set(0, 0, 0);
      modelRoot.rotation.set(0, 0, 0);
      modelRoot.visible = true;
      modelRoot.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      });

      const meshCount = stabilizeModelVisibility(modelRoot);
      const scaleFactor = normalizeModelScale(modelRoot);
      const grounded = alignModelToGround(modelRoot);
      const bounds = describeBox(new THREE.Box3().setFromObject(modelRoot));
      group.userData.manModelRoot = modelRoot;
      group.userData.manScaleFactor = scaleFactor;
      group.add(modelRoot);
      const debugHelpers = attachDebugHelpers(modelRoot);
      if (debugHelpers) {
        group.userData.manDebugHelpers = debugHelpers;
      }
      if (meshCount > 0 && grounded) {
        fallback.visible = false;
      }
      logManDebug("model-attached", {
        meshCount,
        scaleFactor,
        grounded,
        bounds,
        rootPosition: modelRoot.position.toArray(),
        rootScale: modelRoot.scale.toArray(),
        fallbackVisible: fallback.visible,
      });

      const animationState = ensureAnimationState(group, modelRoot, animations);
      const initialKey = "idle";
      startAction(animationState, initialKey);
      group.userData.manTemplateLoaded = true;
    })
    .catch((error) => {
      console.error("[MAN_MODEL] Failed to load Man.glb:", error);
    });

  return group;
}

export function updatePlayerMeshAnimation(mesh, { entity, runtime, movementVisual } = {}) {
  if (!mesh) return;

  const state = mesh.userData.manAnimationState ?? null;
  if (!state) return;

  const modelRoot = mesh.userData.manModelRoot ?? mesh.getObjectByName?.("ManModel") ?? mesh.children.find?.((child) => child?.name === "ManModel") ?? null;
  if (!modelRoot) return;

  const resolvedState = ensureAnimationState(mesh, modelRoot, runtime?.animations ?? []);
  const nextKey = resolveMotionKey(entity, {
    ...(runtime ?? {}),
    movementVisual,
  });
  startAction(resolvedState, nextKey);
  modelRoot.rotation.y = getMotionYawOffset(nextKey);

  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - Number(resolvedState.lastUpdateAtMs ?? now)) / 1000));
  resolvedState.lastUpdateAtMs = now;
  resolvedState.mixer.update(dt);

  if (isManDebugEnabled()) {
    const box = new THREE.Box3().setFromObject(modelRoot);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (!mesh.userData.manDebugLastLogAtMs || now - Number(mesh.userData.manDebugLastLogAtMs) >= 1000) {
      mesh.userData.manDebugLastLogAtMs = now;
      console.log("[MAN_MODEL] frame", {
        entityId: mesh.userData.entityId ?? null,
        key: nextKey,
        meshPosition: mesh.position.toArray(),
        meshRotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
        modelWorldCenter: center.toArray(),
        modelWorldSize: size.toArray(),
        modelVisible: modelRoot.visible,
        fallbackVisible: mesh.getObjectByName?.("ManFallback")?.visible ?? null,
      });
    }
  }
}

export function disposePlayerMesh(mesh) {
  if (!mesh) return;
  mesh.userData.manDisposed = true;

  const state = mesh.userData.manAnimationState ?? null;
  if (state?.mixer) {
    try {
      state.mixer.stopAllAction();
      state.mixer.uncacheRoot(state.mixer.getRoot?.() ?? mesh);
    } catch {}
  }

  mesh.traverse((child) => {
    if (child.geometry) {
      try {
        child.geometry.dispose();
      } catch {}
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        for (const material of child.material) {
          try {
            material?.dispose?.();
          } catch {}
        }
      } else {
        try {
          child.material.dispose?.();
        } catch {}
      }
    }
  });
}

export { MAN_ANIMATION_CATALOG };
