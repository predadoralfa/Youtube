/**
 * ActorFactory.js
 *
 * Factories para criar meshes de actors (Three.js puro)
 * Baseado nos tipos: CHEST, TREE, NPC, DEFAULT
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const chestModelUrl = new URL("../../../assets/Chest.glb", import.meta.url).href;
const rockModelUrl = new URL("../../../assets/Rock.glb", import.meta.url).href;
const appleModelUrl = new URL("../../../assets/Apple.glb", import.meta.url).href;
const grassModelUrl = new URL("../../../assets/Grass.glb", import.meta.url).href;
const treeModelUrl = new URL("../../../assets/Apple tree.glb", import.meta.url).href;
const twigModelUrl = new URL("../../../assets/Twig.glb", import.meta.url).href;

const chestLoader = new GLTFLoader();
const rockLoader = new GLTFLoader();
const appleLoader = new GLTFLoader();
const grassLoader = new GLTFLoader();
const treeLoader = new GLTFLoader();
const twigLoader = new GLTFLoader();
let chestModelPromise = null;
let chestModelTemplate = null;
let rockModelPromise = null;
let rockModelTemplate = null;
let appleModelPromise = null;
let appleModelTemplate = null;
let grassModelPromise = null;
let grassModelTemplate = null;
let treeModelPromise = null;
let treeModelTemplate = null;
let twigModelPromise = null;
let twigModelTemplate = null;

function normalizeAssetKey(assetKey) {
  const raw = String(assetKey ?? "").trim().toUpperCase();

  switch (raw) {
    case "CHEST_TEST":
    case "CHEST":
      return "CHEST";
    case "TREE_APPLE":
    case "APPLE_TREE":
    case "TREE":
    case "APPLE TREE.GLB":
    case "APPLE_TREE.GLB":
    case "TREE.GLB":
      return "TREE";
    case "TWIG_PATCH":
    case "TWIG":
    case "TWIG.GLB":
      return "TWIG_PATCH";
    case "FIBER_PATCH":
    case "GRASS_PATCH":
      return "GRASS";
    case "ROCK_NODE_SMALL":
    case "ROCK":
      return "ROCK";
    case "APPLE":
      return "APPLE";
    case "FIBER":
    case "GRASS":
    case "GRAMA":
      return "GRASS";
    case "GROUND_LOOT":
    case "ITEM_DROP":
    case "DROP":
    case "LOOT_DROP":
      return "ITEM_DROP";
    default:
      return raw || null;
  }
}

function normalizeActorType(actorType) {
  const raw = String(actorType ?? "").trim().toUpperCase();

  switch (raw) {
    case "BAU":
    case "CHEST":
    case "CHEST_TEST":
    case "CONTAINER":
      return "CHEST";
    case "GROUND_LOOT":
    case "ITEM_DROP":
    case "DROP":
    case "LOOT_DROP":
      return "ITEM_DROP";
    case "TREE_APPLE":
    case "APPLE_TREE":
    case "TREE":
      return "TREE";
    case "TWIG_PATCH":
    case "TWIG":
      return "TWIG_PATCH";
    case "RIVER_PATCH":
      return "RIVER_PATCH";
    case "FIBER_PATCH":
    case "GRASS_PATCH":
      return "GRASS";
    case "NPC":
      return "NPC";
    case "PRIMITIVE_SHELTER":
    case "SHELTER":
      return "PRIMITIVE_SHELTER";
    default:
      return raw || "DEFAULT";
  }
}

function normalizeActorKind(actorKind) {
  const raw = String(actorKind ?? "").trim().toUpperCase();
  return raw || null;
}

function resolveRenderActorType(actor) {
  const normalizedAssetKey = normalizeAssetKey(actor?.assetKey ?? null);
  const normalizedActorType = normalizeActorType(
    actor?.actorDefCode ??
    actor?.actorType ??
    actor?.actor_type ??
    null
  );
  const normalizedActorKind = normalizeActorKind(actor?.actorKind ?? null);
  const hasDroppedItemMetadata =
    actor?.state?.itemInstanceId != null ||
    actor?.state?.itemDefId != null ||
    actor?.state?.itemCode != null ||
    actor?.state?.qty != null ||
    actor?.state?.sourceKind != null ||
    actor?.state?.dropSource != null;

  if (normalizedActorType === "ITEM_DROP" || normalizedActorKind === "LOOT" || hasDroppedItemMetadata) {
    return "ITEM_DROP";
  }

  if (normalizedAssetKey) {
    return normalizedAssetKey;
  }

  return normalizedActorType;
}

function applyActorUserData(root, actor, interactive) {
  const baseUserData = {
    actorId: actor.id,
    actorType: actor.actorDefCode ?? actor.actorType,
    actorKind: actor.actorKind ?? null,
    visualHint: actor.visualHint ?? null,
    assetKey: actor.assetKey ?? null,
    interactive,
  };

  root.userData = {
    ...root.userData,
    ...baseUserData,
  };

  root.traverse((child) => {
    child.userData = {
      ...child.userData,
      ...baseUserData,
    };
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

function createChestFallbackMesh(actor) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(1.7, 0.9, 1.15);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7a4a21, roughness: 0.75 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = 0.45;
  group.add(body);

  const lidGeo = new THREE.BoxGeometry(1.76, 0.22, 1.22);
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x5b3418, roughness: 0.7 });
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.castShadow = true;
  lid.receiveShadow = true;
  lid.position.y = 1.02;
  group.add(lid);

  const sideBandGeo = new THREE.BoxGeometry(0.1, 0.7, 1.24);
  const frontBandGeo = new THREE.BoxGeometry(1.8, 0.08, 0.1);
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x8c8f93,
    metalness: 0.75,
    roughness: 0.35,
  });

  for (const x of [-0.64, 0.64]) {
    const band = new THREE.Mesh(sideBandGeo, bandMat);
    band.castShadow = true;
    band.receiveShadow = true;
    band.position.set(x, 0.48, 0);
    group.add(band);
  }

  for (const z of [-0.5, 0.5]) {
    const band = new THREE.Mesh(frontBandGeo, bandMat);
    band.castShadow = true;
    band.receiveShadow = true;
    band.position.set(0, 0.55, z);
    group.add(band);
  }

  const latchGeo = new THREE.BoxGeometry(0.18, 0.22, 0.08);
  const latchMat = new THREE.MeshStandardMaterial({
    color: 0xc79b2c,
    metalness: 0.85,
    roughness: 0.25,
  });
  const latch = new THREE.Mesh(latchGeo, latchMat);
  latch.castShadow = true;
  latch.receiveShadow = true;
  latch.position.set(0, 0.63, 0.62);
  group.add(latch);

  group.castShadow = true;
  group.receiveShadow = true;
  applyActorUserData(group, actor, true);

  return group;
}

async function loadChestModelTemplate() {
  if (chestModelTemplate) return chestModelTemplate;

  if (!chestModelPromise) {
    chestModelPromise = chestLoader.loadAsync(chestModelUrl)
      .then((gltf) => {
        chestModelTemplate = gltf.scene;
        return chestModelTemplate;
      })
      .catch((error) => {
        chestModelPromise = null;
        throw error;
      });
  }

  return chestModelPromise;
}

async function loadRockModelTemplate() {
  if (rockModelTemplate) return rockModelTemplate;

  if (!rockModelPromise) {
    rockModelPromise = rockLoader.loadAsync(rockModelUrl)
      .then((gltf) => {
        rockModelTemplate = gltf.scene;
        return rockModelTemplate;
      })
      .catch((error) => {
        rockModelPromise = null;
        throw error;
      });
  }

  return rockModelPromise;
}

async function loadAppleModelTemplate() {
  if (appleModelTemplate) return appleModelTemplate;

  if (!appleModelPromise) {
    appleModelPromise = appleLoader.loadAsync(appleModelUrl)
      .then((gltf) => {
        appleModelTemplate = gltf.scene;
        return appleModelTemplate;
      })
      .catch((error) => {
        appleModelPromise = null;
        throw error;
      });
  }

  return appleModelPromise;
}

async function loadGrassModelTemplate() {
  if (grassModelTemplate) return grassModelTemplate;

  if (!grassModelPromise) {
    grassModelPromise = grassLoader.loadAsync(grassModelUrl)
      .then((gltf) => {
        grassModelTemplate = gltf.scene;
        return grassModelTemplate;
      })
      .catch((error) => {
        grassModelPromise = null;
        throw error;
      });
  }

  return grassModelPromise;
}

async function loadTreeModelTemplate() {
  if (treeModelTemplate) return treeModelTemplate;

  if (!treeModelPromise) {
    treeModelPromise = treeLoader.loadAsync(treeModelUrl)
      .then((gltf) => {
        treeModelTemplate = gltf.scene;
        return treeModelTemplate;
      })
      .catch((error) => {
        treeModelPromise = null;
        throw error;
      });
  }

  return treeModelPromise;
}

async function loadTwigModelTemplate() {
  if (twigModelTemplate) return twigModelTemplate;

  if (!twigModelPromise) {
    twigModelPromise = twigLoader.loadAsync(twigModelUrl)
      .then((gltf) => {
        twigModelTemplate = gltf.scene;
        return twigModelTemplate;
      })
      .catch((error) => {
        twigModelPromise = null;
        throw error;
      });
  }

  return twigModelPromise;
}

function resolveDroppedItemVisual(actor) {
  const explicitAssetKey = normalizeAssetKey(actor?.assetKey ?? null);
  if (explicitAssetKey === "ROCK") {
    return "ROCK";
  }
  if (explicitAssetKey === "APPLE") {
    return "APPLE";
  }

  const explicitVisualHint = String(actor?.visualHint ?? "").trim().toUpperCase();
  if (explicitVisualHint === "ROCK") {
    return "ROCK";
  }
  if (explicitVisualHint === "APPLE") {
    return "APPLE";
  }

  const itemCode = String(actor?.state?.itemCode ?? "").trim().toUpperCase();
  const itemName = String(actor?.state?.itemName ?? "").trim().toUpperCase();
  const token = `${itemCode} ${itemName}`;

  if (token.includes("STONE") || token.includes("ROCK") || token.includes("PEDRA")) {
    return "ROCK";
  }
  if (token.includes("APPLE") || token.includes("MACA")) {
    return "APPLE";
  }
  if (token.includes("BASKET") || token.includes("CESTA")) {
    return "DEFAULT";
  }
  if (token.includes("FIBER") || token.includes("GRASS") || token.includes("GRAMA")) {
    return "GRASS";
  }

  const normalizedActorType = normalizeActorType(
    actor?.actorDefCode ??
    actor?.actorType ??
    actor?.actor_type ??
    null
  );
  if (normalizedActorType === "ITEM_DROP") {
    return "DEFAULT";
  }

  return "DEFAULT";
}

/**
 * Cria um mesh para CHEST (bau)
 */
export function createChestMesh(actor) {
  const group = new THREE.Group();
  applyActorUserData(group, actor, true);

  loadChestModelTemplate()
    .then((template) => {
      const model = template.clone(true);

      model.scale.setScalar(0.75);
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      alignModelToGround(model);
      applyActorUserData(model, actor, true);
      group.add(model);
    })
    .catch((error) => {
      console.error("[ACTOR_FACTORY] Failed to load chest model:", error);
      group.add(createChestFallbackMesh(actor));
    });

  return group;
}

function createDroppedItemFallbackMesh(actor) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.36, 0.36),
    new THREE.MeshStandardMaterial({
      color: 0xff59c7,
      roughness: 0.42,
      metalness: 0.18,
    })
  );
  base.castShadow = true;
  base.receiveShadow = true;
  base.position.y = 0.18;
  group.add(base);

  applyActorUserData(group, actor, true);
  return group;
}

export function createDroppedItemMesh(actor) {
  const group = new THREE.Group();
  applyActorUserData(group, actor, true);

  const visual = resolveDroppedItemVisual(actor);
  const qty = Number(actor?.state?.qty ?? 1);
  const scaleBoost = qty > 1 ? Math.min(1.35, 1 + Math.log10(qty) * 0.12) : 1;

  if (visual === "ROCK") {
    loadRockModelTemplate()
      .then((template) => {
        const model = template.clone(true);
        model.scale.setScalar(1.35 * scaleBoost);
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        alignModelToGround(model);
        applyActorUserData(model, actor, true);
        group.add(model);
      })
      .catch((error) => {
        console.error("[ACTOR_FACTORY] Failed to load rock model:", error);
        group.add(createDroppedItemFallbackMesh(actor));
      });

    return group;
  }

  if (visual === "APPLE") {
    loadAppleModelTemplate()
      .then((template) => {
        const model = template.clone(true);
        model.scale.setScalar(0.05 * scaleBoost);
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        alignModelToGround(model);
        applyActorUserData(model, actor, true);
        group.add(model);
      })
      .catch((error) => {
        console.error("[ACTOR_FACTORY] Failed to load apple model:", error);
        group.add(createDroppedItemFallbackMesh(actor));
      });

    return group;
  }

  if (visual === "GRASS") {
    loadGrassModelTemplate()
      .then((template) => {
        const model = template.clone(true);
        model.scale.setScalar(0.2 * scaleBoost);
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        alignModelToGround(model);
        applyActorUserData(model, actor, true);
        group.add(model);
      })
      .catch((error) => {
        console.error("[ACTOR_FACTORY] Failed to load grass model:", error);
        group.add(createDroppedItemFallbackMesh(actor));
      });

    return group;
  }

  const fallback = createDroppedItemFallbackMesh(actor);
  fallback.scale.setScalar(scaleBoost);
  group.add(fallback);
  return group;
}

/**
 * Cria um mesh para TREE (arvore)
 */
export function createTreeMesh(actor) {
  const group = new THREE.Group();
  applyActorUserData(group, actor, true);

  loadTreeModelTemplate()
    .then((template) => {
      const model = template.clone(true);
      model.scale.setScalar(1.296);
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      alignModelToGround(model);
      model.position.y -= 0.45;
      applyActorUserData(model, actor, true);
      group.add(model);
    })
    .catch((error) => {
      console.error("[ACTOR_FACTORY] Failed to load tree model:", error);

      const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 3, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      trunk.position.y = 1.5;
      group.add(trunk);

      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const foliageSizes = [
        { radius: 1.5, y: 3.5 },
        { radius: 1.2, y: 4.2 },
        { radius: 0.9, y: 4.8 },
      ];

      for (const { radius, y } of foliageSizes) {
        const foliageGeo = new THREE.SphereGeometry(radius, 8, 8);
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        foliage.position.y = y;
        group.add(foliage);
      }
    });

  return group;
}

/**
 * Cria um mesh para GRASS / Fiber Patch
 */
export function createGrassMesh(actor) {
  const group = new THREE.Group();
  applyActorUserData(group, actor, true);

  loadGrassModelTemplate()
    .then((template) => {
      const model = template.clone(true);
      model.scale.setScalar(0.65);
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      alignModelToGround(model);
      applyActorUserData(model, actor, true);
      group.add(model);
    })
    .catch((error) => {
      console.error("[ACTOR_FACTORY] Failed to load grass actor model:", error);
      group.add(createDroppedItemFallbackMesh(actor));
    });

  return group;
}

export function createTwigPatchMesh(actor) {
  const group = new THREE.Group();
  applyActorUserData(group, actor, true);

  loadTwigModelTemplate()
    .then((template) => {
      const model = template.clone(true);
      model.scale.setScalar(7.5);
      model.position.set(0, 0, 0);
      model.rotation.set(Math.PI / 2, 0.15, Math.PI / 2);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      alignModelToGround(model);
      model.position.y -= 0.02;
      applyActorUserData(model, actor, true);
      group.add(model);
    })
    .catch((error) => {
      console.error("[ACTOR_FACTORY] Failed to load twig actor model:", error);

      const fallbackGeo = new THREE.BoxGeometry(0.7, 0.08, 0.18);
      const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.95 });
      const fallback = new THREE.Mesh(fallbackGeo, fallbackMat);
      fallback.castShadow = true;
      fallback.receiveShadow = true;
      fallback.position.y = 0.04;
      group.add(fallback);
    });

  return group;
}

/**
 * Cria um mesh para RIVER_PATCH (fonte de agua)
 */
export function createRiverMesh(actor) {
  const group = new THREE.Group();
  applyActorUserData(group, actor, true);

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

/**
 * Cria um mesh para PRIMITIVE_SHELTER (projeto de construção)
 */
export function createPrimitiveShelterMesh(actor) {
  const group = new THREE.Group();
  applyActorUserData(group, actor, true);

  const outlinePoints = [
    new THREE.Vector3(-1.3, 0.03, -0.75),
    new THREE.Vector3(1.3, 0.03, -0.75),
    new THREE.Vector3(1.3, 0.03, 0.75),
    new THREE.Vector3(-1.3, 0.03, 0.75),
    new THREE.Vector3(-1.3, 0.03, -0.75),
  ];
  const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
  const outline = new THREE.Line(
    outlineGeometry,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  group.add(outline);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  group.add(floor);

  const postMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.05,
  });
  const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.36, 6), postMat);
  leftPost.position.set(-0.95, 0.18, -0.28);
  group.add(leftPost);

  const rightPost = leftPost.clone();
  rightPost.position.set(0.95, 0.18, -0.28);
  group.add(rightPost);

  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.05, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6, metalness: 0.08 })
  );
  ridge.position.set(0, 0.36, -0.28);
  group.add(ridge);

  return group;
}

/**
 * Cria um mesh para NPC (humanoide)
 */
export function createNPCMesh(actor) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4169e1 });

  const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const head = new THREE.Mesh(headGeo, mat);
  head.castShadow = true;
  head.position.y = 1.7;
  group.add(head);

  const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.castShadow = true;
  body.position.y = 1.1;
  group.add(body);

  const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 6);

  for (let i = -1; i <= 1; i += 2) {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.castShadow = true;
    leg.position.x = i * 0.2;
    leg.position.y = 0.3;
    group.add(leg);
  }

  group.castShadow = true;
  group.receiveShadow = true;
  group.userData = {
    actorId: actor.id,
    actorType: actor.actorType,
    interactive: true,
  };

  return group;
}

/**
 * Cria um mesh DEFAULT (fallback - cubo)
 */
export function createDefaultMesh(actor) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff1493 });
  const mesh = new THREE.Mesh(geo, mat);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    actorId: actor.id,
    actorType: actor.actorType,
    interactive: false,
  };

  return mesh;
}

/**
 * Factory principal: cria mesh baseado em actorType
 */
export function createActorMesh(actor) {
  const actorType = resolveRenderActorType(actor);

  switch (actorType) {
    case "CHEST":
      return createChestMesh(actor);
    case "ITEM_DROP":
      return createDroppedItemMesh(actor);
    case "TREE":
      return createTreeMesh(actor);
    case "TWIG_PATCH":
      return createTwigPatchMesh(actor);
    case "RIVER_PATCH":
      return createRiverMesh(actor);
    case "GRASS":
      return createGrassMesh(actor);
    case "PRIMITIVE_SHELTER":
      return createPrimitiveShelterMesh(actor);
    case "NPC":
      return createNPCMesh(actor);
    default:
      return createDefaultMesh(actor);
  }
}
