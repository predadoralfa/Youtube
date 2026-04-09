import * as THREE from "three";
import { setupCamera } from "../../camera/camera";
import { setupLight } from "../../light/light";
import { applyDayNightCycle } from "../../light/dayNightCycle";
import { readCameraStateFromRuntime } from "../helpers";

export function setupSceneRuntime({ container, runtimeRef, templateRef, worldTimeRef, cameraRef }) {
  const tpl = templateRef.current;
  const sizeX = tpl?.geometry?.size_x ?? 100;
  const sizeZ = tpl?.geometry?.size_z ?? 100;
  const visual = tpl?.visual ?? {};

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

  const groundColor =
    visual?.ground_render_material?.base_color ??
    visual?.ground_color ??
    "#5a5a5a";

  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(sizeX, sizeZ),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(groundColor) })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(sizeX / 2, 0, sizeZ / 2);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

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

  return {
    sizeX,
    sizeZ,
    scene,
    renderer,
    lightRig,
    groundMesh,
    boundsGeometry,
    boundsMaterial,
    cameraApi,
  };
}
