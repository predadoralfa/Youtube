import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useWorldClock } from "@/world/hooks/useWorldClock";
import { createActorMesh } from "@/world/entities/actors/ActorFactory";
import { createSceneObjectMesh } from "@/world/entities/objects/ObjectFactory";
import {
  buildGroundGeometry,
  createGroundSampler,
  createGroundSamplerFromMesh,
  sampleGroundTilt,
} from "./sceneRuntime/terrain";
import { clearProceduralWorld, syncProceduralWorld } from "./sceneRuntime/procedural";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getEntityKind(entity) {
  const kind = String(entity?.kind ?? "").toUpperCase();
  if (kind === "OBJECT") return "OBJECT";
  if (kind === "ACTOR") return "ACTOR";
  if (entity?.objectDefCode || entity?.objectType) return "OBJECT";
  return "ACTOR";
}

function getEntityId(entity, kind) {
  const raw = entity?.id ?? entity?.actorId ?? entity?.sceneObjectId ?? null;
  if (raw != null && String(raw).trim()) return String(raw);
  return `${kind.toLowerCase()}:${Math.random().toString(36).slice(2, 10)}`;
}

function getEntityPos(entity) {
  return {
    x: Number(entity?.pos?.x ?? entity?.x ?? 0),
    y: Number(entity?.pos?.y ?? entity?.y ?? 0),
    z: Number(entity?.pos?.z ?? entity?.z ?? 0),
  };
}

function getEntityScale(entity) {
  return {
    x: Number(entity?.scale?.x ?? entity?.scaleX ?? 1),
    y: Number(entity?.scale?.y ?? entity?.scaleY ?? 1),
    z: Number(entity?.scale?.z ?? entity?.scaleZ ?? 1),
  };
}

function getEntityYaw(entity) {
  return Number(entity?.yaw ?? 0);
}

function normalizePlanarVector(x, z) {
  const length = Math.hypot(Number(x ?? 0), Number(z ?? 0));
  if (!Number.isFinite(length) || length <= 0.000001) {
    return { x: 0, z: 0 };
  }
  return {
    x: Number(x ?? 0) / length,
    z: Number(z ?? 0) / length,
  };
}

function buildEntityMesh(entity) {
  const kind = getEntityKind(entity);
  return kind === "OBJECT" ? createSceneObjectMesh(entity) : createActorMesh(entity);
}

function createCameraApi(camera, options = {}) {
  const state = {
    yaw: 0,
    pitch: Number.isFinite(Number(options.defaultPitch))
      ? Number(options.defaultPitch)
      : THREE.MathUtils.degToRad(24),
    distance: Number.isFinite(Number(options.defaultDistance))
      ? Number(options.defaultDistance)
      : 12,
    focus: { x: 0, y: 0, z: 0 },
    minPitch: Number.isFinite(Number(options.minPitch))
      ? Number(options.minPitch)
      : THREE.MathUtils.degToRad(5),
    maxPitch: Number.isFinite(Number(options.maxPitch))
      ? Number(options.maxPitch)
      : THREE.MathUtils.degToRad(86),
  };
  const target = new THREE.Vector3();

  const applyPose = () => {
    const cosPitch = Math.cos(state.pitch);
    const sinPitch = Math.sin(state.pitch);
    const offsetX = Math.sin(state.yaw) * state.distance * cosPitch;
    const offsetZ = Math.cos(state.yaw) * state.distance * cosPitch;
    const offsetY = sinPitch * state.distance;

    camera.position.set(
      state.focus.x + offsetX,
      state.focus.y + offsetY,
      state.focus.z + offsetZ
    );
    target.set(state.focus.x, state.focus.y, state.focus.z);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };

  applyPose();

  return {
    camera,
    getState() {
      return { ...state, focus: { ...state.focus } };
    },
    setBounds() {
      return this;
    },
    setFocus(nextFocus) {
      if (!nextFocus) return;
      state.focus = {
        x: Number(nextFocus.x ?? 0),
        y: Number(nextFocus.y ?? 0),
        z: Number(nextFocus.z ?? 0),
      };
      applyPose();
    },
    applyOrbit(dx, dy) {
      state.yaw -= Number(dx ?? 0) * 0.006;
      state.pitch = clamp(state.pitch + Number(dy ?? 0) * 0.006, state.minPitch, state.maxPitch);
      applyPose();
    },
    applyZoom(delta) {
      state.distance = clamp(state.distance + Number(delta ?? 0) * 0.01, 4, 80);
      applyPose();
    },
    update(targetLike) {
      if (targetLike?.position) {
        state.focus = {
          x: Number(targetLike.position.x ?? 0),
          y: Number(targetLike.position.y ?? 0),
          z: Number(targetLike.position.z ?? 0),
        };
      } else if (targetLike && typeof targetLike === "object") {
        state.focus = {
          x: Number(targetLike.x ?? 0),
          y: Number(targetLike.y ?? 0),
          z: Number(targetLike.z ?? 0),
        };
      }
      applyPose();
    },
  };
}

function syncEntityMeshes(scene, entityGroupRef, snapshot, allowObjectSelection, sampleGroundHeight) {
  const previous = entityGroupRef.current;
  if (previous) {
    scene.remove(previous);
    previous.traverse((child) => {
      child.geometry?.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose?.());
        } else {
          child.material.dispose?.();
        }
      }
    });
  }

  const group = new THREE.Group();
  group.name = "scene-entities";
  entityGroupRef.current = group;

  const entities = [
    ...(Array.isArray(snapshot?.actors) ? snapshot.actors : []).map((entry) => ({
      ...entry,
      kind: "ACTOR",
    })),
    ...(Array.isArray(snapshot?.sceneObjects) ? snapshot.sceneObjects : []).map((entry) => ({
      ...entry,
      kind: "OBJECT",
    })),
  ];

  for (const entity of entities) {
    const mesh = buildEntityMesh(entity);
    const pos = getEntityPos(entity);
    const scale = getEntityScale(entity);
    const yaw = getEntityYaw(entity);
    const groundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(pos.x, pos.z) : 0);
    const baseAnchor = Number(mesh.geometry?.parameters?.height ?? 1) / 2;
    const anchor =
      mesh.userData?.localOnly || mesh.userData?.editorOnly
        ? 1.5
        : Number.isFinite(baseAnchor)
          ? baseAnchor
          : 0.9;
    mesh.position.set(pos.x, groundY + Number(pos.y ?? 0) + anchor + 0.2, pos.z);
    mesh.rotation.y = yaw;
    const tilt = sampleGroundTilt(sampleGroundHeight, pos.x, pos.z);
    mesh.rotation.x = tilt.pitch;
    mesh.rotation.z = tilt.roll;
    mesh.scale.set(
      Number.isFinite(scale.x) && scale.x > 0 ? scale.x : 1,
      Number.isFinite(scale.y) && scale.y > 0 ? scale.y : 1,
      Number.isFinite(scale.z) && scale.z > 0 ? scale.z : 1
    );
    mesh.userData.allowObjectSelection = allowObjectSelection;
    mesh.userData.groundY = groundY;
    mesh.userData.anchor = anchor;
    group.add(mesh);
  }
  scene.add(group);
}

function syncLocalEditorMeshes(entityGroupRef, focus, yaw, sampleGroundHeight) {
  const group = entityGroupRef?.current ?? null;
  if (!group) return;

  for (const mesh of group.children ?? []) {
    if (!mesh?.userData?.localOnly && !mesh?.userData?.editorOnly) continue;

    const baseAnchor = Number(mesh.geometry?.parameters?.height ?? 1) / 2;
    const anchor = Number.isFinite(baseAnchor) ? baseAnchor : 0.9;
    const groundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(focus.x, focus.z) : 0);
    mesh.position.set(
      Number(focus.x ?? 0),
      groundY + Number(focus.y ?? 0) + anchor + 0.2,
      Number(focus.z ?? 0)
    );
    mesh.rotation.y = Number(yaw ?? 0);
    const tilt = sampleGroundTilt(sampleGroundHeight, Number(focus.x ?? 0), Number(focus.z ?? 0));
    mesh.rotation.x = tilt.pitch;
    mesh.rotation.z = tilt.roll;
  }
}

export function GameCanvas({
  snapshot,
  worldClock,
  worldStoreRef,
  setSnapshot,
  exposeRuntimeRef,
  exposeCameraRef,
  exposeCameraApiRef,
  editorCameraFocusRef,
  editorMoveSpeedRef,
  editorMoveStateRef,
  editorInputStateRef,
  onEditorTick,
  disableSceneInput = false,
  buildPlacement = null,
  inventorySnapshot = null,
  onInputIntent = null,
  disableInput = false,
  onTargetSelect = null,
  onTargetClear = null,
  allowObjectSelection = false,
  disableGroundMove = false,
  disableWorldEntities = false,
  cameraOptions = {},
  containerRef = null,
}) {
  useWorldClock(worldClock);
  const localContainerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const cameraApiRef = useRef(null);
  const entityGroupRef = useRef(null);
  const snapshotRef = useRef(snapshot);
  const animationRef = useRef(0);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const groundSamplerRef = useRef(null);
  const proceduralWorldRef = useRef(null);

  const mergedContainerRef = containerRef ?? localContainerRef;

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const container = mergedContainerRef.current;
    if (!container) return undefined;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10151d);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.outline = "none";
    renderer.domElement.tabIndex = 0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(60, width / Math.max(1, height), 0.1, 1000);
    camera.position.set(0, 10, 12);
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xfff2d1, 2.0);
    dirLight.position.set(20, 30, 10);
    scene.add(dirLight);

    const template = snapshotRef.current?.localTemplate ?? {};
    const sizeX = Number(template?.geometry?.size_x ?? 100);
    const sizeZ = Number(template?.geometry?.size_z ?? 100);
    const proceduralMap = snapshotRef.current?.proceduralMap ?? null;
    const visual = template?.visual ?? {};

    const ground = new THREE.Mesh(
      buildGroundGeometry(sizeX, sizeZ, proceduralMap),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(visual?.ground_render_material?.base_color ?? visual?.ground_color ?? "#5a5a5a"),
        roughness: 1,
        metalness: 0,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(sizeX / 2, 0, sizeZ / 2);
    ground.receiveShadow = true;
    ground.name = "scene-ground";
    scene.add(ground);
    groundSamplerRef.current = createGroundSamplerFromMesh(
      ground,
      createGroundSampler(sizeX, sizeZ, proceduralMap)
    );

    const bounds = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.05, 0),
        new THREE.Vector3(sizeX, 0.05, 0),
        new THREE.Vector3(sizeX, 0.05, sizeZ),
        new THREE.Vector3(0, 0.05, sizeZ),
      ]),
      new THREE.LineBasicMaterial({ color: 0xf4b942 })
    );
    scene.add(bounds);

    const cameraApi = createCameraApi(camera, cameraOptions);
    cameraApiRef.current = cameraApi;
    if (exposeCameraApiRef) exposeCameraApiRef.current = cameraApi;
    if (exposeCameraRef) exposeCameraRef.current = camera;
    if (exposeRuntimeRef) exposeRuntimeRef.current = { pos: { x: 0, y: 0, z: 0 } };
    if (editorCameraFocusRef?.current) {
      cameraApi.setFocus(editorCameraFocusRef.current);
    }

    if (proceduralMap) {
      proceduralWorldRef.current = syncProceduralWorld(
        {
          scene,
          sampleGroundHeight: groundSamplerRef.current,
          proceduralWorldGroup: null,
          proceduralWorldState: null,
          proceduralFocus: {
            x: Number(editorCameraFocusRef?.current?.x ?? 0),
            z: Number(editorCameraFocusRef?.current?.z ?? 0),
          },
        },
        proceduralMap,
        Number(editorCameraFocusRef?.current?.x ?? 0),
        Number(editorCameraFocusRef?.current?.z ?? 0)
      );
    }

    const handleResize = () => {
      const nextWidth = container.clientWidth || window.innerWidth;
      const nextHeight = container.clientHeight || window.innerHeight;
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / Math.max(1, nextHeight);
      camera.updateProjectionMatrix();
    };

    const handlePointerDown = (event) => {
      if (event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      mouseRef.current.x = x * 2 - 1;
      mouseRef.current.y = -(y * 2 - 1);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const candidates = entityGroupRef.current?.children ?? [];
      const hits = raycasterRef.current.intersectObjects(candidates, true);
      if (!hits.length) {
        onTargetClear?.();
        return;
      }
      const picked = hits[0].object;
      const userData = picked?.userData ?? {};
      if (userData.editorOnly || userData.localOnly) return;
      if (userData.actorId != null) {
        onTargetSelect?.({ kind: "ACTOR", id: String(userData.actorId) });
        return;
      }
      if (allowObjectSelection && userData.objectId != null) {
        onTargetSelect?.({ kind: "OBJECT", id: String(userData.objectId) });
        return;
      }
      onTargetClear?.();
    };

    const handleContextMenu = (event) => {
      event.preventDefault();
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown, true);
    renderer.domElement.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("resize", handleResize);
    handleResize();

    let lastFrame = performance.now();
    const tick = (now) => {
      const dt = Math.max(0, Math.min((now - lastFrame) / 1000, 0.05));
      lastFrame = now;

      const previousCameraState = cameraApiRef.current?.getState?.() ?? null;
      const focusRef = editorCameraFocusRef?.current ?? { x: 0, y: 0, z: 0 };
      const moveState = editorMoveStateRef?.current ?? null;
      const moveSpeed = Math.max(0, Number(editorMoveSpeedRef?.current ?? 0));
      const speedScale = Math.max(0, Number(moveState?.speedScale ?? 1));
      const moveDir = normalizePlanarVector(moveState?.dir?.x ?? 0, moveState?.dir?.z ?? 0);
      const movedFocus = {
        x: Number(focusRef.x ?? 0),
        y: Number(focusRef.y ?? 0),
        z: Number(focusRef.z ?? 0),
      };

      if ((moveDir.x !== 0 || moveDir.z !== 0) && previousCameraState) {
        const yaw = Number(previousCameraState.yaw ?? 0);
        const forwardX = -Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);
        const worldDir = normalizePlanarVector(
          rightX * moveDir.x + forwardX * moveDir.z,
          rightZ * moveDir.x + forwardZ * moveDir.z
        );
        const distance = moveSpeed * speedScale * dt;
        movedFocus.x += worldDir.x * distance;
        movedFocus.z += worldDir.z * distance;
      }

      if (editorCameraFocusRef?.current) {
        editorCameraFocusRef.current = movedFocus;
      }
      if (cameraApiRef.current) {
        cameraApiRef.current.setFocus(movedFocus);
      }

      const currentCameraState = cameraApiRef.current?.getState?.() ?? null;
      const currentFocus = currentCameraState?.focus ?? movedFocus;
      const editorYaw = Number(currentCameraState?.yaw ?? 0) + Math.PI;
      syncLocalEditorMeshes(entityGroupRef, currentFocus, editorYaw, groundSamplerRef.current);
      if (editorInputStateRef?.current) {
        editorInputStateRef.current = {
          ...editorInputStateRef.current,
          cameraYaw: Number(currentCameraState?.yaw ?? 0),
          focusX: Number(currentFocus.x ?? 0),
          focusY: Number(currentFocus.y ?? 0),
          focusZ: Number(currentFocus.z ?? 0),
        };
      }

      if (exposeRuntimeRef) {
        exposeRuntimeRef.current = {
          pos: {
            x: Number(currentFocus.x ?? 0),
            y: Number(currentFocus.y ?? 0),
            z: Number(currentFocus.z ?? 0),
          },
        };
      }

      if (onEditorTick) {
        onEditorTick({
          pos: {
            x: Number(currentFocus.x ?? 0),
            y: Number(currentFocus.y ?? 0),
            z: Number(currentFocus.z ?? 0),
          },
          yaw: Number(currentCameraState?.yaw ?? 0),
        });
      }

      if (proceduralMap && groundSamplerRef.current && proceduralWorldRef.current) {
        syncProceduralWorld(
          {
            scene,
            sampleGroundHeight: groundSamplerRef.current,
            proceduralWorldGroup: proceduralWorldRef.current,
            proceduralWorldState: null,
            proceduralFocus: currentFocus,
          },
          proceduralMap,
          Number(currentFocus.x ?? 0),
          Number(currentFocus.z ?? 0)
        );
      }

      renderer.render(scene, camera);
      animationRef.current = window.requestAnimationFrame(tick);
    };

    animationRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown, true);
      renderer.domElement.removeEventListener("contextmenu", handleContextMenu, true);
      try {
        renderer.dispose();
      } catch {}
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      if (exposeRuntimeRef) exposeRuntimeRef.current = null;
      if (exposeCameraRef) exposeCameraRef.current = null;
      if (exposeCameraApiRef) exposeCameraApiRef.current = null;
      if (proceduralWorldRef.current) {
        clearProceduralWorld({
          scene,
          proceduralWorldGroup: proceduralWorldRef.current,
        });
      }
    };
  }, [
    mergedContainerRef,
    cameraOptions,
    editorCameraFocusRef,
    editorInputStateRef,
    onEditorTick,
    onTargetClear,
    onTargetSelect,
    allowObjectSelection,
    disableInput,
    exposeRuntimeRef,
    exposeCameraRef,
    exposeCameraApiRef,
  ]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const currentSnapshot = snapshotRef.current;
    const template = currentSnapshot?.localTemplate ?? {};
    const sizeX = Number(template?.geometry?.size_x ?? 100);
    const sizeZ = Number(template?.geometry?.size_z ?? 100);
    const proceduralMap = currentSnapshot?.proceduralMap ?? null;
    const ground = scene.getObjectByName("scene-ground");
    if (ground) {
      ground.geometry?.dispose?.();
      ground.geometry = buildGroundGeometry(sizeX, sizeZ, proceduralMap);
      ground.updateMatrixWorld(true);
      groundSamplerRef.current = createGroundSamplerFromMesh(
        ground,
        createGroundSampler(sizeX, sizeZ, proceduralMap)
      );
    }
    if (proceduralMap) {
      syncProceduralWorld(
        {
          scene,
          sampleGroundHeight: groundSamplerRef.current,
          proceduralWorldGroup: proceduralWorldRef.current,
          proceduralWorldState: null,
          proceduralFocus: {
            x: Number(currentSnapshot?.runtime?.pos?.x ?? 0),
            z: Number(currentSnapshot?.runtime?.pos?.z ?? 0),
          },
        },
        proceduralMap,
        Number(currentSnapshot?.runtime?.pos?.x ?? 0),
        Number(currentSnapshot?.runtime?.pos?.z ?? 0)
      );
    }

    syncEntityMeshes(scene, entityGroupRef, currentSnapshot, allowObjectSelection, groundSamplerRef.current);
  }, [snapshot, allowObjectSelection]);

  return (
    <div
      ref={mergedContainerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        isolation: "isolate",
      }}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
