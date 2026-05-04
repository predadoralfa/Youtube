import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getObjectDisplayColor, normalizeObjectAssetKey } from "./ObjectMappings";

const rockModelUrl = new URL("../../../../../client/src/assets/Rock.glb", import.meta.url).href;
const rockLoader = new GLTFLoader();
let rockModelPromise = null;
let rockModelTemplate = null;

function applyObjectUserData(root, sceneObject) {
  const baseUserData = {
    kind: "OBJECT",
    objectId: sceneObject.id,
    objectType: sceneObject.objectDefCode ?? sceneObject.objectType ?? null,
    assetKey: sceneObject.assetKey ?? null,
    displayName: sceneObject.displayName ?? null,
    interactive: false,
    localOnly: Boolean(sceneObject?.localOnly),
    editorOnly: Boolean(sceneObject?.editorOnly),
  };

  root.userData = { ...root.userData, ...baseUserData };
  root.traverse((child) => {
    child.userData = { ...child.userData, ...baseUserData };
  });
}

function alignModelToGround(model) {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

async function loadRockModelTemplate() {
  if (rockModelTemplate) return rockModelTemplate;
  if (!rockModelPromise) {
    rockModelPromise = rockLoader.loadAsync(rockModelUrl).then((gltf) => {
      rockModelTemplate = gltf.scene;
      return rockModelTemplate;
    });
  }
  return rockModelPromise;
}

function createRockFallbackMesh(sceneObject) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 1),
    new THREE.MeshStandardMaterial({
      color: getObjectDisplayColor(sceneObject?.assetKey ?? sceneObject?.objectType),
      roughness: 0.95,
      metalness: 0.02,
    })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = 0.9;
  group.add(mesh);
  applyObjectUserData(group, sceneObject);
  return group;
}

function createBenchFallbackMesh(sceneObject) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.45), woodMat);
  seat.position.set(0, 0.75, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.14), woodMat);
  back.position.set(0, 1.05, -0.18);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  const legGeo = new THREE.BoxGeometry(0.12, 0.75, 0.12);
  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(x, 0.375, z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    }
  }

  applyObjectUserData(group, sceneObject);
  return group;
}

function createLampPostFallbackMesh(sceneObject) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.6, metalness: 0.3 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 12), poleMat);
  pole.position.y = 1.7;
  pole.castShadow = true;
  pole.receiveShadow = true;
  group.add(pole);

  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.5, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xfff1bf, emissive: 0x4a3d18, roughness: 0.35 })
  );
  lamp.position.set(0, 3.35, 0);
  lamp.castShadow = true;
  lamp.receiveShadow = true;
  group.add(lamp);

  applyObjectUserData(group, sceneObject);
  return group;
}

function createDefaultObjectMesh(sceneObject) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: getObjectDisplayColor(sceneObject?.assetKey ?? sceneObject?.objectType),
      roughness: 0.8,
      metalness: 0.08,
    })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  applyObjectUserData(mesh, sceneObject);
  return mesh;
}

function createEditorCharacterMesh(sceneObject) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: getObjectDisplayColor(sceneObject?.assetKey ?? sceneObject?.objectType),
    roughness: 0.72,
    metalness: 0.04,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x102433,
    roughness: 0.45,
    metalness: 0.12,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 1.45, 14), bodyMaterial);
  body.position.y = 0.78;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), bodyMaterial);
  head.position.y = 1.62;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.16), accentMaterial);
  visor.position.set(0, 1.55, 0.34);
  visor.castShadow = true;
  visor.receiveShadow = true;
  group.add(visor);

  const feet = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.58, 0.16, 12), accentMaterial);
  feet.position.y = 0.08;
  feet.castShadow = true;
  feet.receiveShadow = true;
  group.add(feet);

  applyObjectUserData(group, sceneObject);
  return group;
}

function createRockMesh(sceneObject) {
  const group = new THREE.Group();
  applyObjectUserData(group, sceneObject);

  loadRockModelTemplate()
    .then((template) => {
      const model = template.clone(true);
      model.scale.setScalar(9);
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      alignModelToGround(model);
      applyObjectUserData(model, sceneObject);
      group.add(model);
    })
    .catch((error) => {
      console.error("[SCENE_CREATOR_OBJECT_FACTORY] Failed to load rock model:", error);
      group.add(createRockFallbackMesh(sceneObject));
    });

  return group;
}

export function createSceneObjectMesh(sceneObject) {
  const assetKey = normalizeObjectAssetKey(sceneObject?.assetKey ?? sceneObject?.objectDefCode ?? sceneObject?.objectType);

  switch (assetKey) {
    case "ROCK":
      return createRockMesh(sceneObject);
    case "EDITOR_CHARACTER":
      return createEditorCharacterMesh(sceneObject);
    case "WOOD_BENCH_01":
      return createBenchFallbackMesh(sceneObject);
    case "LAMP_POST_01":
      return createLampPostFallbackMesh(sceneObject);
    default:
      return createDefaultObjectMesh(sceneObject);
  }
}
