import * as THREE from "three";
import { setupCamera } from "../../camera/camera";
import { setupLight } from "../../light/light";
import { applyDayNightCycle } from "../../light/dayNightCycle";
import { readCameraStateFromRuntime } from "../helpers";
import { buildGroundGeometry, createGroundSampler, createGroundSamplerFromMesh } from "./terrain";
import { clearProceduralWorld, syncProceduralWorld } from "./procedural";

function buildGroundMaterial(visual = {}) {
  const groundColor =
    visual?.ground_render_material?.base_color ??
    visual?.ground_color ??
    "#5a5a5a";

  return new THREE.MeshStandardMaterial({ color: new THREE.Color(groundColor) });
}

export function applySceneTemplate(runtime, tpl, proceduralMap = null) {
  if (!runtime) return;

  const sizeX = Number(tpl?.geometry?.size_x ?? 100);
  const sizeZ = Number(tpl?.geometry?.size_z ?? 100);
  const visual = tpl?.visual ?? {};

  runtime.cameraApi.setBounds({ sizeX, sizeZ });

  if (runtime.groundMesh) {
    runtime.groundMesh.geometry?.dispose?.();
    runtime.groundMesh.geometry = buildGroundGeometry(sizeX, sizeZ, proceduralMap ?? null);
    runtime.groundMesh.position.set(sizeX / 2, 0, sizeZ / 2);
    runtime.groundMesh.updateMatrixWorld(true);

    const nextGroundMaterial = buildGroundMaterial(visual);
    const prevMaterial = runtime.groundMesh.material;
    runtime.groundMesh.material = nextGroundMaterial;
    try {
      prevMaterial?.dispose?.();
    } catch {}
  }

  if (runtime.boundsLine) {
    const points = [
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(sizeX, 0.2, 0),
      new THREE.Vector3(sizeX, 0.2, sizeZ),
      new THREE.Vector3(0, 0.2, sizeZ),
    ];

    runtime.boundsLine.geometry?.dispose?.();
    runtime.boundsLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }

  if (runtime.groundSamplerRef) {
    const fallbackSampler = createGroundSampler(sizeX, sizeZ, proceduralMap ?? null);
    runtime.groundSamplerRef.current = createGroundSamplerFromMesh(
      runtime.groundMesh,
      fallbackSampler
    );
  }

  if (proceduralMap) {
    runtime.proceduralMap = proceduralMap;
    syncProceduralWorld(
      runtime,
      proceduralMap,
      runtime.proceduralFocus?.x ?? 0,
      runtime.proceduralFocus?.z ?? 0
    );
  } else {
    runtime.proceduralMap = null;
    clearProceduralWorld(runtime);
  }
}

export function setupSceneRuntime({
  container,
  runtimeRef,
  templateRef,
  proceduralMapRef,
  worldTimeRef,
  cameraRef,
}) {
  const tpl = templateRef.current;
  const sizeX = Number(tpl?.geometry?.size_x ?? 100);
  const sizeZ = Number(tpl?.geometry?.size_z ?? 100);
  const visual = tpl?.visual ?? {};
  const groundSamplerRef = { current: null };
  const initialRuntime = runtimeRef.current ?? null;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.left = "0";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.zIndex = "0";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const cameraApi = setupCamera(container, readCameraStateFromRuntime(runtimeRef.current));
  cameraRef.current = cameraApi.camera;

  const lightRig = setupLight(scene);
  applyDayNightCycle({
    scene,
    renderer,
    hemiLight: lightRig.hemiLight,
    dirLight: lightRig.dirLight,
    worldTime: worldTimeRef.current,
  });

  cameraApi.setBounds({ sizeX, sizeZ });
  window.addEventListener("resize", cameraApi.onResize);

  const groundMesh = new THREE.Mesh(
    buildGroundGeometry(sizeX, sizeZ, proceduralMapRef?.current ?? null),
    buildGroundMaterial(visual)
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(sizeX / 2, 0, sizeZ / 2);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
  groundMesh.updateMatrixWorld(true);
  groundSamplerRef.current = createGroundSamplerFromMesh(
    groundMesh,
    createGroundSampler(sizeX, sizeZ, proceduralMapRef?.current ?? null)
  );

  const points = [
    new THREE.Vector3(0, 0.2, 0),
    new THREE.Vector3(sizeX, 0.2, 0),
    new THREE.Vector3(sizeX, 0.2, sizeZ),
    new THREE.Vector3(0, 0.2, sizeZ),
  ];
  const boundsGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const boundsMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const bounds = new THREE.LineLoop(boundsGeometry, boundsMaterial);
  bounds.frustumCulled = false;
  scene.add(bounds);

  const runtime = {
    sizeX,
    sizeZ,
    scene,
    renderer,
    lightRig,
    groundMesh,
    boundsLine: bounds,
    boundsGeometry,
    boundsMaterial,
    cameraApi,
    groundSamplerRef,
    proceduralWorldGroup: null,
    proceduralWorldState: null,
    proceduralMap: proceduralMapRef?.current ?? null,
    proceduralFocus: {
      x: Number(initialRuntime?.pos?.x ?? 0),
      z: Number(initialRuntime?.pos?.z ?? 0),
    },
    sampleGroundHeight: (x, z) =>
      groundSamplerRef.current?.(x, z) ?? createGroundSampler(sizeX, sizeZ, proceduralMapRef?.current ?? null)(x, z),
  };

  applySceneTemplate(runtime, tpl, proceduralMapRef?.current ?? null);

  if (initialRuntime?.pos) {
    const initialTarget = new THREE.Object3D();
    const initialX = Number(initialRuntime.pos?.x ?? 0);
    const initialZ = Number(initialRuntime.pos?.z ?? 0);
    const initialY = Number(runtime.sampleGroundHeight(initialX, initialZ) ?? 0);
    initialTarget.position.set(initialX, initialY, initialZ);
    cameraApi.update(initialTarget, 0);
  }

  return runtime;
}
