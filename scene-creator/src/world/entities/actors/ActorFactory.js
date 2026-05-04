import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { normalizeActorType } from "./ActorMappings";

const chestModelUrl = new URL("../../../../../client/src/assets/Chest.glb", import.meta.url).href;
const rockModelUrl = new URL("../../../../../client/src/assets/Rock.glb", import.meta.url).href;
const appleModelUrl = new URL("../../../../../client/src/assets/Apple.glb", import.meta.url).href;
const grassModelUrl = new URL("../../../../../client/src/assets/Grass.glb", import.meta.url).href;
const treeModelUrl = new URL("../../../../../client/src/assets/Apple tree.glb", import.meta.url).href;
const twigModelUrl = new URL("../../../../../client/src/assets/Twig.glb", import.meta.url).href;
const herbsModelUrl = new URL("../../../../../client/src/assets/Herbs.glb", import.meta.url).href;
const primitiveShelterModelUrl = new URL("../../../../../client/src/assets/Primitive Shelter.glb", import.meta.url).href;

const loader = new GLTFLoader();
const modelCache = new Map();

function applyActorUserData(root, actor) {
  const baseUserData = {
    kind: "ACTOR",
    actorId: actor.id,
    actorType: actor.actorDefCode ?? actor.actorType ?? null,
    assetKey: actor.assetKey ?? null,
    displayName: actor.displayName ?? null,
    interactive: false,
    localOnly: Boolean(actor?.localOnly),
    editorOnly: Boolean(actor?.editorOnly),
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

async function loadTemplate(url) {
  if (modelCache.has(url)) return modelCache.get(url);
  const promise = loader.loadAsync(url).then((gltf) => gltf.scene);
  modelCache.set(url, promise);
  return promise;
}

function makeFallbackMesh(actor, color = 0x808080) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  applyActorUserData(group, actor);
  return group;
}

function makeCapsuleFallback(actor, color = 0x59c5ff) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 1.0, 6, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04 })
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  applyActorUserData(group, actor);
  return group;
}

function makeRockFallback(actor) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 1),
    new THREE.MeshStandardMaterial({ color: 0x7c7c7c, roughness: 0.95, metalness: 0.02 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = 0.9;
  group.add(mesh);
  applyActorUserData(group, actor);
  return group;
}

function makeTreeFallback(actor) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x654321 })
  );
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.position.y = 1.5;
  group.add(trunk);

  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
  for (const { radius, y } of [
    { radius: 1.5, y: 3.5 },
    { radius: 1.2, y: 4.2 },
    { radius: 0.9, y: 4.8 },
  ]) {
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), foliageMat);
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    foliage.position.y = y;
    group.add(foliage);
  }

  applyActorUserData(group, actor);
  return group;
}

function makeRiverMesh(actor) {
  const group = new THREE.Group();
  applyActorUserData(group, actor);

  const baseGeo = new THREE.PlaneGeometry(6.5, 2.4, 1, 1);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1d8fe3,
    roughness: 0.2,
    metalness: 0.05,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.03;
  base.castShadow = false;
  base.receiveShadow = true;
  group.add(base);

  const foamGeo = new THREE.PlaneGeometry(6.1, 2.0, 1, 1);
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0x7fd9ff,
    roughness: 0.15,
    metalness: 0.02,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
  });
  const foam = new THREE.Mesh(foamGeo, foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.02;
  foam.castShadow = false;
  foam.receiveShadow = true;
  group.add(foam);

  group.castShadow = false;
  group.receiveShadow = true;
  return group;
}

async function attachTemplate(group, actor, url, { scale = 1, heightShift = 0, rotate = [0, 0, 0] } = {}) {
  try {
    const template = await loadTemplate(url);
    const model = template.clone(true);
    model.scale.setScalar(scale);
    model.rotation.set(rotate[0], rotate[1], rotate[2]);
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    alignModelToGround(model);
    if (Number.isFinite(heightShift) && heightShift !== 0) {
      model.position.y += heightShift;
    }
    applyActorUserData(model, actor);
    group.add(model);
  } catch (error) {
    console.error("[SCENE_CREATOR_ACTOR_FACTORY] Failed to load model:", url, error);
    group.add(makeFallbackMesh(actor));
  }
}

export function createActorMesh(actor) {
  const kind = normalizeActorType(actor?.actorDefCode ?? actor?.actorType ?? actor?.assetKey);
  const group = new THREE.Group();
  applyActorUserData(group, actor);

  switch (kind) {
    case "CHEST":
      attachTemplate(group, actor, chestModelUrl, { scale: 0.75 }).catch(() => group.add(makeFallbackMesh(actor, 0x7a4a21)));
      return group;
    case "ROCK":
      attachTemplate(group, actor, rockModelUrl, { scale: 9 }).catch(() => group.add(makeRockFallback(actor)));
      return group;
    case "TREE":
      attachTemplate(group, actor, treeModelUrl, { scale: 1.296, heightShift: -0.45 }).catch(() => group.add(makeTreeFallback(actor)));
      return group;
    case "TWIG_PATCH":
      attachTemplate(group, actor, twigModelUrl, { scale: 7.5, rotate: [Math.PI / 2, 0.15, Math.PI / 2], heightShift: -0.02 }).catch(() => group.add(makeFallbackMesh(actor, 0x8a5a2b)));
      return group;
    case "HERBS_PATCH":
      attachTemplate(group, actor, herbsModelUrl, { scale: 0.68, rotate: [0, 0.2, 0], heightShift: -0.02 }).catch(() => group.add(makeFallbackMesh(actor, 0x4ade80)));
      return group;
    case "RIVER_PATCH":
      group.add(makeRiverMesh(actor));
      return group;
    case "PRIMITIVE_SHELTER":
      attachTemplate(group, actor, primitiveShelterModelUrl, { scale: 1.35, heightShift: 0.02 }).catch(() => group.add(makeFallbackMesh(actor, 0xe5e7eb)));
      return group;
    case "GRASS":
      attachTemplate(group, actor, grassModelUrl, { scale: 0.65 }).catch(() => group.add(makeFallbackMesh(actor, 0x58a548)));
      return group;
    case "NPC":
      attachTemplate(group, actor, new URL("../../../../../client/src/assets/Man.glb", import.meta.url).href, { scale: 1 }).catch(() => group.add(makeCapsuleFallback(actor, 0x4169e1)));
      return group;
    case "ITEM_DROP":
      attachTemplate(group, actor, rockModelUrl, { scale: 0.2 }).catch(() => group.add(makeFallbackMesh(actor, 0xff59c7)));
      return group;
    default:
      group.add(makeCapsuleFallback(actor, 0xf4b942));
      return group;
  }
}
