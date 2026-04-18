import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSeed(seed) {
  const value = Number(seed);
  if (Number.isFinite(value) && value !== 0) return value;
  return 1337;
}

function resolveChunkConfig(proceduralMap) {
  const chunkSize = Math.max(64, Number(proceduralMap?.chunkSize ?? 256));
  const chunkRadius = Math.max(0, Math.floor(Number(proceduralMap?.chunkRadius ?? 1)));
  const maxChunkX = Math.max(0, Math.ceil(Number(proceduralMap?.size?.x ?? 0) / chunkSize) - 1);
  const maxChunkZ = Math.max(0, Math.ceil(Number(proceduralMap?.size?.z ?? 0) / chunkSize) - 1);
  return { chunkSize, chunkRadius, maxChunkX, maxChunkZ };
}

function makeTreeTrunkMaterial() {
  return new THREE.MeshStandardMaterial({ color: "#5b3a1f", roughness: 0.95 });
}

function makeTreeCrownMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#1f4f1f",
    roughness: 0.9,
    flatShading: true,
  });
}

function makeRockMaterial() {
  return new THREE.MeshStandardMaterial({ color: "#7f8084", roughness: 1 });
}

function makeGrassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#58a548",
    roughness: 1,
    flatShading: true,
  });
}

function makePathMaterial() {
  return new THREE.MeshStandardMaterial({ color: "#6f5536", roughness: 1 });
}

function disposeNode(node) {
  if (!node) return;
  node.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material?.dispose?.());
      } else {
        child.material.dispose?.();
      }
    }
  });
}

function getChunkKey(chunkX, chunkZ) {
  return `${chunkX}:${chunkZ}`;
}

function getChunkSeed(worldSeed, chunkX, chunkZ) {
  const seed = normalizeSeed(worldSeed) >>> 0;
  const x = Math.imul(chunkX + 0x9e3779b9, 0x85ebca6b) >>> 0;
  const z = Math.imul(chunkZ + 0xc2b2ae35, 0xc2b2ae35) >>> 0;
  return (seed ^ x ^ z) >>> 0;
}

function createChunkCapacity() {
  return {
    treeInstances: 0,
    rockInstances: 0,
    grassTiles: 0,
    pathTiles: 0,
  };
}

function createChunkMeshes(capacity) {
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1.9, 6);
  const crownGeo = new THREE.ConeGeometry(1.1, 2.5, 6);
  const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
  const grassGeo = new THREE.BoxGeometry(1, 1, 1);
  const pathGeo = new THREE.BoxGeometry(1, 1, 1);

  const trunkMat = makeTreeTrunkMaterial();
  const crownMat = makeTreeCrownMaterial();
  const rockMat = makeRockMaterial();
  const grassMat = makeGrassMaterial();
  const pathMat = makePathMaterial();

  const treeTrunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, capacity.treeInstances));
  const treeCrownMesh = new THREE.InstancedMesh(crownGeo, crownMat, Math.max(1, capacity.treeInstances));
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, Math.max(1, capacity.rockInstances));
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, Math.max(1, capacity.grassTiles));
  const pathMesh = new THREE.InstancedMesh(pathGeo, pathMat, Math.max(1, capacity.pathTiles));

  treeTrunkMesh.castShadow = true;
  treeTrunkMesh.receiveShadow = true;
  treeCrownMesh.castShadow = true;
  treeCrownMesh.receiveShadow = true;
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  grassMesh.castShadow = true;
  grassMesh.receiveShadow = true;
  pathMesh.castShadow = true;
  pathMesh.receiveShadow = true;

  return { treeTrunkMesh, treeCrownMesh, rockMesh, grassMesh, pathMesh };
}

function placeTree({
  trunkMesh,
  crownMesh,
  index,
  x,
  z,
  groundY,
  trunkHeight,
  crownHeight,
  crownScale,
  yaw,
  pitch,
  roll,
}) {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Euler(pitch, yaw, roll, "XYZ");
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  scale.set(1, trunkHeight / 1.9, 1);
  position.set(x, groundY + trunkHeight * 0.5, z);
  matrix.compose(position, quaternion, scale);
  trunkMesh.setMatrixAt(index, matrix);

  position.set(x, groundY + trunkHeight + crownHeight * 0.35, z);
  scale.set(crownScale, crownHeight / 2.5, crownScale);
  matrix.compose(position, quaternion, scale);
  crownMesh.setMatrixAt(index, matrix);
}

function placeRock({ rockMesh, index, x, z, groundY, rockScale, yaw, pitch, roll }) {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Euler(pitch, yaw, roll, "XYZ");
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  scale.set(rockScale * 1.1, rockScale * 0.8, rockScale * 1.0);
  position.set(x, groundY + 0.3 * rockScale, z);
  matrix.compose(position, quaternion, scale);
  rockMesh.setMatrixAt(index, matrix);
}

function placeGrassTile({ grassMesh, index, x, z, groundY, width, length, height, yaw = 0 }) {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Euler(0, yaw, 0, "XYZ");
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  scale.set(width, height, length);
  position.set(x, groundY + height * 0.5, z);
  matrix.compose(position, quaternion, scale);
  grassMesh.setMatrixAt(index, matrix);
}

function placePathTile({ pathMesh, index, x, z, groundY, width, length, yaw = 0 }) {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Euler(0, yaw, 0, "XYZ");
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  scale.set(width, 0.04, length);
  position.set(x, groundY + 0.02, z);
  matrix.compose(position, quaternion, scale);
  pathMesh.setMatrixAt(index, matrix);
}

function estimateChunkCapacity(proceduralMap, chunkX, chunkZ) {
  const { chunkRadius, maxChunkX, maxChunkZ } = resolveChunkConfig(proceduralMap);
  const isStartChunk = chunkX === 0 && chunkZ === 0;
  const edgeDistance = Math.min(chunkX, chunkZ, maxChunkX - chunkX, maxChunkZ - chunkZ);
  const edgeBias = edgeDistance <= chunkRadius ? 0.55 : 1;

  return {
    treeInstances: isStartChunk ? 18 : Math.max(6, Math.round(10 * edgeBias)),
    rockInstances: isStartChunk ? 12 : Math.max(4, Math.round(7 * edgeBias)),
    grassTiles: isStartChunk ? 324 : Math.max(196, Math.round(256 * edgeBias)),
    pathTiles: isStartChunk ? 18 : Math.max(12, Math.round(16 * edgeBias)),
  };
}

function buildChunkGroup(runtime, proceduralMap, chunkX, chunkZ) {
  if (!runtime?.scene || !proceduralMap) return null;

  const { chunkSize, maxChunkX, maxChunkZ } = resolveChunkConfig(proceduralMap);
  if (chunkX < 0 || chunkZ < 0 || chunkX > maxChunkX || chunkZ > maxChunkZ) return null;

  const worldSeed = normalizeSeed(proceduralMap?.worldSeed);
  const chunkSeed = getChunkSeed(worldSeed, chunkX, chunkZ);
  const rnd = mulberry32(chunkSeed);
  const noise2D = createNoise2D(rnd);
  const capacity = estimateChunkCapacity(proceduralMap, chunkX, chunkZ);
  const meshes = createChunkMeshes(capacity);
  const group = new THREE.Group();
  const originX = chunkX * chunkSize;
  const originZ = chunkZ * chunkSize;

  group.name = `procedural-chunk:${chunkX}:${chunkZ}`;
  group.userData.chunkX = chunkX;
  group.userData.chunkZ = chunkZ;
  group.userData.chunkKey = getChunkKey(chunkX, chunkZ);

  const sampleGroundHeight = runtime.sampleGroundHeight;
  let treeIndex = 0;
  let rockIndex = 0;
  let grassIndex = 0;
  let pathIndex = 0;

  const pathCenterDrift = (zValue) =>
    (chunkX === 0 && chunkZ === 0 ? 30 : originX + chunkSize * 0.5) +
    Math.sin((originZ + zValue) * 0.0065 + worldSeed * 0.0000015) * 12.5 +
    Math.sin((originZ + zValue) * 0.012 + chunkX * 0.45) * 2.8;

  const placeSpecialStartProps = chunkX === 0 && chunkZ === 0;
  if (placeSpecialStartProps) {
    const heroTreeX = originX + 30;
    const heroTreeZ = originZ + 24;
    const heroTreeGroundY = Number(sampleGroundHeight?.(heroTreeX, heroTreeZ) ?? 0);
    placeTree({
      trunkMesh: meshes.treeTrunkMesh,
      crownMesh: meshes.treeCrownMesh,
      index: treeIndex,
      x: heroTreeX,
      z: heroTreeZ,
      groundY: heroTreeGroundY,
      trunkHeight: 12.5,
      crownHeight: 14.8,
      crownScale: 5.8,
      yaw: 0.35,
      pitch: 0.03,
      roll: -0.02,
    });
    treeIndex += 1;

    const companionTreeX = originX + 16;
    const companionTreeZ = originZ + 36;
    const companionTreeGroundY = Number(sampleGroundHeight?.(companionTreeX, companionTreeZ) ?? 0);
    placeTree({
      trunkMesh: meshes.treeTrunkMesh,
      crownMesh: meshes.treeCrownMesh,
      index: treeIndex,
      x: companionTreeX,
      z: companionTreeZ,
      groundY: companionTreeGroundY,
      trunkHeight: 9.8,
      crownHeight: 11.5,
      crownScale: 4.2,
      yaw: 2.1,
      pitch: 0.02,
      roll: 0.01,
    });
    treeIndex += 1;
  }

  const grassCols = 18;
  const grassRows = 18;
  const grassDensity = Number(proceduralMap?.scatter?.grassDensity ?? 0.9);
  const pathWidth = 4.25;
  const grassThreshold = 0.42 + grassDensity * 0.28;

  for (let row = 0; row < grassRows; row += 1) {
    for (let col = 0; col < grassCols; col += 1) {
      const baseX = originX + ((col + 0.5) / grassCols) * chunkSize;
      const baseZ = originZ + ((row + 0.5) / grassRows) * chunkSize;
      const jitterX = (noise2D(col * 0.37 + chunkX * 0.13, row * 0.23 + chunkZ * 0.09) * 0.5) * (chunkSize / grassCols);
      const jitterZ = (noise2D(col * 0.19 + 9.7 + chunkX * 0.07, row * 0.21 + 4.3 + chunkZ * 0.11) * 0.5) * (chunkSize / grassRows);
      const x = THREE.MathUtils.clamp(baseX + jitterX, originX + 1.5, originX + chunkSize - 1.5);
      const z = THREE.MathUtils.clamp(baseZ + jitterZ, originZ + 1.5, originZ + chunkSize - 1.5);
      const groundY = Number(sampleGroundHeight?.(x, z) ?? 0);
      const pathCenterX = pathCenterDrift(z);
      const pathDistance = Math.abs(x - pathCenterX);
      const inPathBand = pathDistance <= pathWidth;
      const grassNoise = noise2D(x * 0.05 + worldSeed * 0.0001, z * 0.05 - worldSeed * 0.0002);
      const shouldPlaceGrass = grassNoise > grassThreshold || !inPathBand;

      if (shouldPlaceGrass && grassIndex < meshes.grassMesh.count) {
        const tileW = inPathBand ? 1.6 + rnd() * 1.2 : 4.0 + rnd() * 2.8;
        const tileL = inPathBand ? 1.6 + rnd() * 1.2 : 4.0 + rnd() * 2.8;
        placeGrassTile({
          grassMesh: meshes.grassMesh,
          index: grassIndex,
          x,
          z,
          groundY,
          width: tileW,
          length: tileL,
          height: 0.025 + rnd() * 0.035,
          yaw: rnd() * Math.PI,
        });
        grassIndex += 1;
      }

      if (pathIndex < meshes.pathMesh.count && inPathBand && row < grassRows - 1) {
        const pathWidthScale = 2.8 + (noise2D(x * 0.03, z * 0.03) * 0.8);
        const pathOffsetX = noise2D(x * 0.05, z * 0.05) * 1.25;
        placePathTile({
          pathMesh: meshes.pathMesh,
          index: pathIndex,
          x: x + pathOffsetX,
          z,
          groundY,
          width: pathWidthScale,
          length: Math.max(3.5, chunkSize / grassRows * 0.96),
          yaw: noise2D(x * 0.01, z * 0.01) * 0.04,
        });
        pathIndex += 1;
      }
    }
  }

  const treeDensityBase = Number(proceduralMap?.scatter?.treeDensity ?? 0.7);
  const rockDensityBase = Number(proceduralMap?.scatter?.rockDensity ?? 0.35);
  const maxSlope = Number(proceduralMap?.scatter?.maxSlope ?? 0.5);
  const cols = 6;
  const rows = 6;
  const cellW = chunkSize / cols;
  const cellZ = chunkSize / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const baseX = originX + (col + 0.5) * cellW;
      const baseZ = originZ + (row + 0.5) * cellZ;
      const jitterX = (noise2D(col * 0.37 + chunkX * 0.13, row * 0.23 + chunkZ * 0.09) * 0.32) * cellW;
      const jitterZ = (noise2D(col * 0.19 + 9.7 + chunkX * 0.07, row * 0.21 + 4.3 + chunkZ * 0.11) * 0.32) * cellZ;
      const x = THREE.MathUtils.clamp(baseX + jitterX, originX + 2, originX + chunkSize - 2);
      const z = THREE.MathUtils.clamp(baseZ + jitterZ, originZ + 2, originZ + chunkSize - 2);
      const groundY = Number(sampleGroundHeight?.(x, z) ?? 0);
      const slopeNoise = Math.abs(noise2D(x * 0.02, z * 0.02));
      const slopeOk = slopeNoise <= maxSlope + 0.25;
      const noiseValue = noise2D(x * 0.08 + worldSeed * 0.0001, z * 0.08 - worldSeed * 0.0002);
      const localDensityBias = 1 - THREE.MathUtils.clamp(Math.abs(chunkX - 0) * 0.08 + Math.abs(chunkZ - 0) * 0.04, 0, 0.65);
      const treeChance = treeDensityBase * localDensityBias * (placeSpecialStartProps ? 0.65 : 0.35);
      const rockChance = rockDensityBase * localDensityBias * 0.7 + 0.12;

      if (treeIndex < meshes.treeTrunkMesh.count && slopeOk) {
        if (noiseValue > -0.08 && rnd() < treeChance) {
          const trunkHeight = placeSpecialStartProps ? 4.8 + rnd() * 1.8 : 3.1 + rnd() * 1.6;
          const crownHeight = placeSpecialStartProps ? 6.6 + rnd() * 2.0 : 4.2 + rnd() * 1.4;
          const crownScale = placeSpecialStartProps ? 2.6 + rnd() * 1.1 : 1.6 + rnd() * 0.8;
          const tilt = noise2D(x * 0.11, z * 0.11) * 0.06 + (rnd() - 0.5) * 0.02;
          placeTree({
            trunkMesh: meshes.treeTrunkMesh,
            crownMesh: meshes.treeCrownMesh,
            index: treeIndex,
            x,
            z,
            groundY,
            trunkHeight,
            crownHeight,
            crownScale,
            yaw: rnd() * Math.PI,
            pitch: tilt,
            roll: tilt * 0.5,
          });
          treeIndex += 1;
        }
      }

      if (rockIndex < meshes.rockMesh.count && slopeOk) {
        const rockNoise = noise2D(x * 0.14 + 4.2 + chunkX * 0.2, z * 0.14 - 2.1 + chunkZ * 0.2);
        if (rockNoise > 0.22 && rnd() < rockChance) {
          const rockScale = 0.75 + rnd() * 0.8;
          placeRock({
            rockMesh: meshes.rockMesh,
            index: rockIndex,
            x,
            z,
            groundY,
            rockScale,
            yaw: rnd() * Math.PI,
            pitch: rnd() * 0.15,
            roll: rnd() * 0.1,
          });
          rockIndex += 1;
        }
      }
    }
  }

  meshes.treeTrunkMesh.count = treeIndex;
  meshes.treeCrownMesh.count = treeIndex;
  meshes.rockMesh.count = rockIndex;
  meshes.grassMesh.count = grassIndex;
  meshes.pathMesh.count = pathIndex;
  meshes.treeTrunkMesh.instanceMatrix.needsUpdate = true;
  meshes.treeCrownMesh.instanceMatrix.needsUpdate = true;
  meshes.rockMesh.instanceMatrix.needsUpdate = true;
  meshes.grassMesh.instanceMatrix.needsUpdate = true;
  meshes.pathMesh.instanceMatrix.needsUpdate = true;

  group.add(meshes.treeTrunkMesh);
  group.add(meshes.treeCrownMesh);
  group.add(meshes.rockMesh);
  group.add(meshes.grassMesh);
  group.add(meshes.pathMesh);

  return group;
}

function ensureProceduralRoot(runtime) {
  if (!runtime?.scene) return null;

  if (!runtime.proceduralWorldGroup) {
    const root = new THREE.Group();
    root.name = "procedural-world-root";
    root.userData.chunkGroups = new Map();
    root.userData.chunkSignature = null;
    runtime.scene.add(root);
    runtime.proceduralWorldGroup = root;
  }

  if (!(runtime.proceduralWorldGroup.userData.chunkGroups instanceof Map)) {
    runtime.proceduralWorldGroup.userData.chunkGroups = new Map();
  }

  return runtime.proceduralWorldGroup;
}

export function clearProceduralWorld(runtime) {
  const group = runtime?.proceduralWorldGroup ?? null;
  if (!group) return;

  group.userData.destroyed = true;
  runtime.scene?.remove?.(group);
  disposeNode(group);
  runtime.proceduralWorldGroup = null;
  runtime.proceduralWorldState = null;
}

export function syncProceduralWorld(runtime, proceduralMap, focusX = null, focusZ = null) {
  if (!runtime?.scene || !proceduralMap) {
    clearProceduralWorld(runtime);
    return null;
  }

  const root = ensureProceduralRoot(runtime);
  if (!root) return null;

  const { chunkSize, chunkRadius, maxChunkX, maxChunkZ } = resolveChunkConfig(proceduralMap);
  const worldSeed = normalizeSeed(proceduralMap?.worldSeed);
  const resolvedFocusX =
    Number.isFinite(Number(focusX)) && Number.isFinite(Number(focusZ))
      ? Number(focusX)
      : Number(runtime.proceduralFocus?.x ?? 0);
  const resolvedFocusZ =
    Number.isFinite(Number(focusX)) && Number.isFinite(Number(focusZ))
      ? Number(focusZ)
      : Number(runtime.proceduralFocus?.z ?? 0);
  const centerChunkX = THREE.MathUtils.clamp(Math.floor(resolvedFocusX / chunkSize), 0, maxChunkX);
  const centerChunkZ = THREE.MathUtils.clamp(Math.floor(resolvedFocusZ / chunkSize), 0, maxChunkZ);
  const signature = `${worldSeed}:${chunkSize}:${chunkRadius}:${centerChunkX}:${centerChunkZ}:${maxChunkX}:${maxChunkZ}`;

  if (root.userData.chunkSignature === signature) {
    return root;
  }

  const desired = new Set();
  for (let dx = -chunkRadius; dx <= chunkRadius; dx += 1) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz += 1) {
      const chunkX = centerChunkX + dx;
      const chunkZ = centerChunkZ + dz;
      if (chunkX < 0 || chunkZ < 0 || chunkX > maxChunkX || chunkZ > maxChunkZ) continue;
      desired.add(getChunkKey(chunkX, chunkZ));
    }
  }

  const chunkGroups = root.userData.chunkGroups;
  for (const [chunkKey, chunkGroup] of chunkGroups.entries()) {
    if (desired.has(chunkKey)) continue;
    root.remove(chunkGroup);
    disposeNode(chunkGroup);
    chunkGroups.delete(chunkKey);
  }

  for (const chunkKey of desired) {
    if (chunkGroups.has(chunkKey)) continue;
    const [chunkXRaw, chunkZRaw] = chunkKey.split(":");
    const chunkX = Number(chunkXRaw);
    const chunkZ = Number(chunkZRaw);
    const chunkGroup = buildChunkGroup(runtime, proceduralMap, chunkX, chunkZ);
    if (!chunkGroup) continue;
    chunkGroups.set(chunkKey, chunkGroup);
    root.add(chunkGroup);
  }

  root.userData.chunkSignature = signature;
  runtime.proceduralWorldState = { worldSeed, chunkSize, chunkRadius, centerChunkX, centerChunkZ };
  runtime.proceduralWorldGroup = root;
  return root;
}

export function buildProceduralWorld(runtime, proceduralMap) {
  const focusX = Number(runtime?.proceduralFocus?.x ?? 0);
  const focusZ = Number(runtime?.proceduralFocus?.z ?? 0);
  return syncProceduralWorld(runtime, proceduralMap, focusX, focusZ);
}
