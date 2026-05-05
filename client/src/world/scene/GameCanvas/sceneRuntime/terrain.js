import * as THREE from "three";

function resolveGridSize(size) {
  return Math.max(1, Math.min(4, Math.round(Number(size) > 0 ? Number(size) / 256 : 1)));
}

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildGroundGeometry(sizeX, sizeZ) {
  const segmentsX = resolveGridSize(sizeX);
  const segmentsZ = resolveGridSize(sizeZ);
  const geometry = new THREE.PlaneGeometry(sizeX, sizeZ, segmentsX, segmentsZ);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGroundSampler() {
  return () => 0;
}

export function createGroundSamplerFromMesh(groundMesh, fallbackSampler) {
  const fallback =
    typeof fallbackSampler === "function"
      ? fallbackSampler
      : () => 0;

  const geometry = groundMesh?.geometry ?? null;
  const positions = geometry?.attributes?.position ?? null;
  const width = Number(geometry?.parameters?.width);
  const height = Number(geometry?.parameters?.height);
  const segmentsX = Number(geometry?.parameters?.widthSegments);
  const segmentsZ = Number(geometry?.parameters?.heightSegments);

  if (!groundMesh || !positions || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !Number.isInteger(segmentsX) || segmentsX <= 0 || !Number.isInteger(segmentsZ) || segmentsZ <= 0) {
    return fallback;
  }

  groundMesh.updateMatrixWorld(true);

  const cols = segmentsX + 1;
  const expectedCount = cols * (segmentsZ + 1);
  if (positions.count < expectedCount) return fallback;

  const heights = new Float32Array(expectedCount);
  for (let i = 0; i < expectedCount; i += 1) {
    heights[i] = positions.getZ(i);
  }

  const inverseMatrixWorld = groundMesh.matrixWorld.clone().invert();
  const matrixWorld = groundMesh.matrixWorld.clone();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();

  const readHeight = (ix, iz) => heights[iz * cols + ix] ?? 0;

  return (x, z) => {
    const worldX = toFinite(x, 0);
    const worldZ = toFinite(z, 0);
    local.set(worldX, 0, worldZ).applyMatrix4(inverseMatrixWorld);

    const u = THREE.MathUtils.clamp((local.x + width / 2) / width, 0, 1);
    const v = THREE.MathUtils.clamp((height / 2 - local.y) / height, 0, 1);
    const cellX = u * segmentsX;
    const cellZ = v * segmentsZ;
    const x0 = Math.floor(cellX);
    const z0 = Math.floor(cellZ);
    const x1 = Math.min(segmentsX, x0 + 1);
    const z1 = Math.min(segmentsZ, z0 + 1);
    const tx = cellX - x0;
    const tz = cellZ - z0;

    const h00 = readHeight(x0, z0);
    const h10 = readHeight(x1, z0);
    const h01 = readHeight(x0, z1);
    const h11 = readHeight(x1, z1);
    const hx0 = h00 + (h10 - h00) * tx;
    const hx1 = h01 + (h11 - h01) * tx;
    const localHeight = hx0 + (hx1 - hx0) * tz;

    world.set(local.x, local.y, localHeight).applyMatrix4(matrixWorld);
    return Number.isFinite(world.y) ? world.y : fallback(worldX, worldZ);
  };
}

export function sampleGroundTilt(sampleGroundHeight, x, z, delta = 1.5) {
  if (typeof sampleGroundHeight !== "function") {
    return { pitch: 0, roll: 0 };
  }

  const left = Number(sampleGroundHeight(x - delta, z));
  const right = Number(sampleGroundHeight(x + delta, z));
  const back = Number(sampleGroundHeight(x, z - delta));
  const front = Number(sampleGroundHeight(x, z + delta));
  if (![left, right, back, front].every(Number.isFinite)) {
    return { pitch: 0, roll: 0 };
  }

  return { pitch: 0, roll: 0 };
}
