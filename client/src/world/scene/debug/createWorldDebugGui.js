import * as THREE from "three";
import GUI from "lil-gui";
import { getSocket } from "@/services/Socket";
import { mergeSnapshotActor } from "@/world/GameShell/helpers";

const WORLD_DEBUG_GUI_MARKER = "world-debug-gui";

function shouldShowWorldDebugGui() {
  const flag = String(import.meta.env?.VITE_SHOW_WORLD_GUI ?? "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return Boolean(import.meta.env.DEV);
}

function safeDestroy(gui) {
  try {
    gui?.destroy?.();
  } catch {}

  const dom = gui?.domElement ?? null;
  if (dom?.parentNode) {
    dom.parentNode.removeChild(dom);
  }
}

function toTransformJSON(object) {
  if (!object) return null;
  return {
    position: {
      x: Number(object.position?.x ?? 0),
      y: Number(object.position?.y ?? 0),
      z: Number(object.position?.z ?? 0),
    },
    rotation: {
      x: Number(object.rotation?.x ?? 0),
      y: Number(object.rotation?.y ?? 0),
      z: Number(object.rotation?.z ?? 0),
    },
    scale: {
      x: Number(object.scale?.x ?? 1),
      y: Number(object.scale?.y ?? 1),
      z: Number(object.scale?.z ?? 1),
    },
  };
}

function applyObjectTransform(object, transform) {
  if (!object || !transform) return;
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
  object.updateMatrixWorld?.(true);
}

function bindVector3Folder(folder, vector, labelPrefix, min = -500, max = 500, step = 0.01, onChange = null) {
  folder
    .add(vector, "x", min, max, step)
    .name(`${labelPrefix}.x`)
    .listen()
    .onChange(() => onChange?.());
  folder
    .add(vector, "y", min, max, step)
    .name(`${labelPrefix}.y`)
    .listen()
    .onChange(() => onChange?.());
  folder
    .add(vector, "z", min, max, step)
    .name(`${labelPrefix}.z`)
    .listen()
    .onChange(() => onChange?.());
}

function bindRotationFolder(folder, euler, labelPrefix) {
  folder.add(euler, "x", -Math.PI, Math.PI, 0.001).name(`${labelPrefix}.x`).listen();
  folder.add(euler, "y", -Math.PI, Math.PI, 0.001).name(`${labelPrefix}.y`).listen();
  folder.add(euler, "z", -Math.PI, Math.PI, 0.001).name(`${labelPrefix}.z`).listen();
}

function bindScaleFolder(folder, scale, labelPrefix) {
  folder.add(scale, "x", 0.01, 50, 0.01).name(`${labelPrefix}.x`).listen();
  folder.add(scale, "y", 0.01, 50, 0.01).name(`${labelPrefix}.y`).listen();
  folder.add(scale, "z", 0.01, 50, 0.01).name(`${labelPrefix}.z`).listen();
}

function resolveActorId(object) {
  const rawActorId = object?.userData?.actorId ?? object?.userData?.actor_id ?? null;
  if (rawActorId == null) return null;

  const actorId = String(rawActorId).trim();
  return actorId.length > 0 ? actorId : null;
}

function readObjectPosition(object) {
  return {
    x: Number(object?.position?.x ?? 0),
    y: Number(object?.position?.y ?? 0),
    z: Number(object?.position?.z ?? 0),
  };
}

function createActorPositionCommitter(state, object) {
  const actorId = resolveActorId(object);
  if (!actorId) return null;

  return () => {
    const position = readObjectPosition(object);
    const sampleGroundHeight = state?.sampleGroundHeight;
    const groundY = typeof sampleGroundHeight === "function" ? Number(sampleGroundHeight(position.x, position.z) ?? 0) : 0;
    const actorPosition = {
      x: position.x,
      y: Number.isFinite(groundY) ? position.y - groundY : position.y,
      z: position.z,
    };

    if (Array.isArray(state?.actorsRef?.current)) {
      state.actorsRef.current = state.actorsRef.current.map((actor) =>
        String(actor?.id ?? "") === actorId
          ? {
              ...actor,
              pos: {
                ...(actor?.pos ?? {}),
                ...actorPosition,
              },
            }
          : actor
      );
    }

    if (typeof state?.setSnapshot === "function") {
      state.setSnapshot((prev) =>
        mergeSnapshotActor(prev, {
          id: actorId,
          actor: {
            pos: actorPosition,
          },
        })
      );
    }

    const socket = getSocket();
    socket?.emit?.("actor:update_position", {
      actorId,
      pos: actorPosition,
    });

    object?.updateMatrixWorld?.(true);
  };
}

export function createWorldDebugGui({ scene, camera, renderer, refs = {}, flags = {}, onFlagsChange = null, container = null }) {
  if (!shouldShowWorldDebugGui()) {
    return {
      gui: null,
      dispose: () => {},
      syncSelectedObject: () => {},
    };
  }

  const target = container?.ownerDocument ? container : document.body;
  const existing = target.querySelector?.(`[data-debug-panel="${WORLD_DEBUG_GUI_MARKER}"]`);
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const gui = new GUI({ title: "World Debug" });
  gui.domElement.dataset.debugPanel = WORLD_DEBUG_GUI_MARKER;
  gui.domElement.style.position = "fixed";
  gui.domElement.style.top = "0";
  gui.domElement.style.right = "0";
  gui.domElement.style.zIndex = "9999";
  gui.domElement.style.maxHeight = "100vh";
  gui.domElement.style.overflow = "auto";
  target.appendChild(gui.domElement);

  const runtimeScene = scene ?? null;
  const runtimeCamera = camera ?? null;
  const runtimeRenderer = renderer ?? null;
  const runtimeGroundMesh = refs.groundMesh ?? null;
  const runtimeBoundsLine = refs.boundsLine ?? null;
  const runtimeLightRig = refs.lightRig ?? null;
  const runtimeSelectedObjectRef = refs.selectedObjectRef ?? null;

  const state = {
    showHelpers: Boolean(flags.showHelpers ?? false),
    showGrid: Boolean(flags.showGrid ?? false),
    showAxes: Boolean(flags.showAxes ?? false),
    showBounds: Boolean(flags.showBounds ?? false),
  };

  const sceneFolder = gui.addFolder("Scene");
  const cameraFolder = gui.addFolder("Camera");
  const lightsFolder = gui.addFolder("Lights");
  const terrainFolder = gui.addFolder("Terrain");
  const helpersFolder = gui.addFolder("Helpers");
  let selectedFolder = null;
  let selectedObject = null;

  const gridHelper = new THREE.GridHelper(200, 200, 0x32516b, 0x102030);
  gridHelper.position.y = 0.01;
  gridHelper.visible = false;
  runtimeScene?.add?.(gridHelper);

  const axesHelper = new THREE.AxesHelper(18);
  axesHelper.position.y = 0.05;
  axesHelper.visible = false;
  runtimeScene?.add?.(axesHelper);

  function refreshHelpers() {
    const showGrid = Boolean(state.showGrid || state.showHelpers);
    const showAxes = Boolean(state.showAxes || state.showHelpers);
    gridHelper.visible = showGrid;
    axesHelper.visible = showAxes;
    if (runtimeBoundsLine) {
      runtimeBoundsLine.visible = Boolean(state.showBounds);
    }
    onFlagsChange?.({ ...state });
  }

  helpersFolder.add(state, "showHelpers").name("showHelpers").onChange(refreshHelpers);
  helpersFolder.add(state, "showGrid").name("showGrid").onChange(refreshHelpers);
  helpersFolder.add(state, "showAxes").name("showAxes").onChange(refreshHelpers);
  helpersFolder.add(state, "showBounds").name("showBounds").onChange(refreshHelpers);

  const sceneActions = {
    logSceneChildren() {
      const children = Array.isArray(runtimeScene?.children) ? runtimeScene.children : [];
      console.log("[WORLD_DEBUG] scene.children", children);
    },
    logRendererInfo() {
      console.log("[WORLD_DEBUG] renderer.info", runtimeRenderer?.info ?? null);
    },
    logSelectedObject() {
      console.log("[WORLD_DEBUG] selectedObject", runtimeSelectedObjectRef?.current ?? selectedObject ?? null);
    },
  };
  sceneFolder.add(sceneActions, "logSceneChildren").name("Log scene.children");
  sceneFolder.add(sceneActions, "logRendererInfo").name("Log renderer.info");
  sceneFolder.add(sceneActions, "logSelectedObject").name("Log selected object");

  if (runtimeCamera) {
    cameraFolder.add(runtimeCamera.position, "x", -500, 500, 0.01).name("position.x").listen();
    cameraFolder.add(runtimeCamera.position, "y", -500, 500, 0.01).name("position.y").listen();
    cameraFolder.add(runtimeCamera.position, "z", -500, 500, 0.01).name("position.z").listen();
    cameraFolder.add(runtimeCamera.rotation, "x", -Math.PI, Math.PI, 0.001).name("rotation.x").listen();
    cameraFolder.add(runtimeCamera.rotation, "y", -Math.PI, Math.PI, 0.001).name("rotation.y").listen();
    cameraFolder.add(runtimeCamera.rotation, "z", -Math.PI, Math.PI, 0.001).name("rotation.z").listen();
    if ("zoom" in runtimeCamera) {
      cameraFolder
        .add(runtimeCamera, "zoom", 0.05, 8, 0.01)
        .name("zoom")
        .listen()
        .onChange(() => runtimeCamera.updateProjectionMatrix?.());
    }
    cameraFolder
      .add({ logCamera() { console.log("[WORLD_DEBUG] camera", toTransformJSON(runtimeCamera)); } }, "logCamera")
      .name("Log camera");
  }

  const light = runtimeLightRig?.dirLight ?? null;
  if (light) {
    const lightState = {
      intensity: Number(light.intensity ?? 1),
      x: Number(light.position?.x ?? 0),
      y: Number(light.position?.y ?? 0),
      z: Number(light.position?.z ?? 0),
      color: `#${light.color?.getHexString?.() ?? "ffffff"}`,
    };
    lightsFolder.add(lightState, "intensity", 0, 10, 0.01).name("intensity").onChange((value) => {
      light.intensity = Number(value ?? 1);
    });
    lightsFolder.add(lightState, "x", -200, 200, 0.01).name("position.x").onChange((value) => {
      light.position.x = Number(value ?? 0);
    });
    lightsFolder.add(lightState, "y", -200, 200, 0.01).name("position.y").onChange((value) => {
      light.position.y = Number(value ?? 0);
    });
    lightsFolder.add(lightState, "z", -200, 200, 0.01).name("position.z").onChange((value) => {
      light.position.z = Number(value ?? 0);
    });
    lightsFolder.addColor(lightState, "color").name("color").onChange((value) => {
      light.color?.set?.(value);
    });
  }

  if (runtimeGroundMesh) {
    terrainFolder.add(runtimeGroundMesh.position, "x", -500, 500, 0.01).name("position.x").listen();
    terrainFolder.add(runtimeGroundMesh.position, "y", -50, 50, 0.01).name("position.y").listen();
    terrainFolder.add(runtimeGroundMesh.position, "z", -500, 500, 0.01).name("position.z").listen();
    terrainFolder.add(runtimeGroundMesh.scale, "x", 0.01, 50, 0.01).name("scale.x").listen();
    terrainFolder.add(runtimeGroundMesh.scale, "y", 0.01, 50, 0.01).name("scale.y").listen();
    terrainFolder.add(runtimeGroundMesh.scale, "z", 0.01, 50, 0.01).name("scale.z").listen();
    terrainFolder.add(runtimeGroundMesh, "visible").name("visible").listen();
  }

  function destroySelectedFolder() {
    if (!selectedFolder) return;
    try {
      selectedFolder.destroy?.();
    } catch {}
    selectedFolder = null;
  }

  function buildSelectedFolder(object, label = "Selected Object") {
    destroySelectedFolder();
    selectedFolder = gui.addFolder(label);

    if (!object) {
      const emptyState = { message: "No selected object" };
      const controller = selectedFolder.add(emptyState, "message").name("status");
      controller.domElement.style.pointerEvents = "none";
      controller.domElement.style.opacity = "0.72";
      return;
    }

    bindVector3Folder(selectedFolder, object.position, "position", -500, 500, 0.01, createActorPositionCommitter(refs.state ?? null, object));
    bindRotationFolder(selectedFolder, object.rotation, "rotation");
    bindScaleFolder(selectedFolder, object.scale, "scale");

    selectedFolder.add(object, "visible").name("visible").listen();

    const selectedActions = {
      logSelectedTransform() {
        console.log("[WORLD_DEBUG] selectedTransform", toTransformJSON(object));
      },
      copySelectedTransformJSON() {
        const payload = JSON.stringify(toTransformJSON(object), null, 2);
        if (navigator?.clipboard?.writeText) {
          void navigator.clipboard.writeText(payload);
          return;
        }
        window.prompt?.("Copy selected transform JSON", payload);
      },
      resetSelectedTransform() {
        applyObjectTransform(object, {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        });
      },
    };

    selectedFolder.add(selectedActions, "logSelectedTransform").name("Log selected transform");
    selectedFolder.add(selectedActions, "copySelectedTransformJSON").name("Copy selected transform JSON");
    selectedFolder.add(selectedActions, "resetSelectedTransform").name("Reset selected transform");
  }

  function syncSelectedObject(nextObject) {
    if (nextObject === selectedObject) return;
    selectedObject = nextObject ?? null;
    const label =
      String(nextObject?.userData?.displayName ?? nextObject?.name ?? nextObject?.userData?.actorType ?? "Selected Object").trim() ||
      "Selected Object";
    buildSelectedFolder(selectedObject, `Selected Object: ${label}`);
  }

  syncSelectedObject(runtimeSelectedObjectRef?.current ?? null);
  refreshHelpers();

  return {
    gui,
    syncSelectedObject,
    dispose: () => {
      try {
        runtimeScene?.remove?.(gridHelper);
        runtimeScene?.remove?.(axesHelper);
      } catch {}
      destroySelectedFolder();
      safeDestroy(gui);
    },
  };
}
