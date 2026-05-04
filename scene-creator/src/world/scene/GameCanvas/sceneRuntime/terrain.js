import * as THREE from "three";

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveGroundHeightRaw(sizeX, sizeZ, x, z, proceduralMap = null) {
  if (!proceduralMap) {
    return 0;
  }

  const safeSizeX = Math.max(1, toFinite(sizeX, 1));
  const safeSizeZ = Math.max(1, toFinite(sizeZ, 1));
  const halfX = safeSizeX / 2;
  const halfZ = safeSizeZ / 2;
  const fx = (toFinite(x, 0) - halfX) / halfX;
  const fz = (toFinite(z, 0) - halfZ) / halfZ;

  const distanceFromCenter = Math.hypot(fx, fz);
  const centerRise = Math.pow(Math.max(0, 1 - distanceFromCenter), 1.4) * 36;
  const corridorRise = Math.pow(Math.max(0, 1 - Math.abs(fz)), 0.58) * 32;
  const sideRise = Math.pow(Math.max(0, 1 - Math.abs(fx)), 0.82) * 10;

  const waveA = Math.sin(fx * 1.7 + fz * 0.7) * 5.2;
  const waveB = Math.cos(fx * 1.05 - fz * 1.25) * 4.1;
  const waveC = Math.sin((fx + fz) * 1.35) * 2.8;
  const waveD = Math.cos((fx - fz) * 1.95) * 2.2;
  const gentleNoise = Math.sin((fx * fx + fz * fz) * 1.75) * 1.7;
  const longRidge = Math.sin(fz * 2.8) * Math.pow(Math.max(0, 1 - Math.abs(fx) * 0.55), 1.4) * 8.5;

  const edgeFade = Math.max(0.55, 1 - Math.min(1, distanceFromCenter) * 0.85);
  const terrain = proceduralMap?.terrain ?? null;
  const amplitude = Math.max(0, Number(terrain?.heightAmplitude ?? 1));
  const roughness = Math.max(0, Number(terrain?.roughness ?? 1));
  const plateauRatio = Math.max(0, Number(terrain?.plateauRatio ?? 0));
  const slopeLimit = Math.max(0, Number(terrain?.slopeLimit ?? 1));
  const valleyDepth = Math.max(0, Number(terrain?.valleyDepth ?? 0));

  const scale = 1 + amplitude / 18;
  const roughMix = 0.55 + roughness * 0.45;
  const plateauMix = 0.55 + plateauRatio * 0.35;
  const valleyMix = 1 + valleyDepth * 0.35;
  const slopeMix = 0.65 + slopeLimit * 0.5;

  return (centerRise * plateauMix + corridorRise * slopeMix + sideRise * roughMix + (waveA + waveB + waveC + waveD) * roughMix + gentleNoise + longRidge * valleyMix) * edgeFade * scale;
}

function resolveGridSize(size) {
  return Math.max(64, Math.min(256, Math.round(size / 120)));
}

function sampleGroundHeight(sizeX, sizeZ, x, z, proceduralMap = null) {
  const safeSizeX = Math.max(1, toFinite(sizeX, 1));
  const safeSizeZ = Math.max(1, toFinite(sizeZ, 1));
  const segmentsX = resolveGridSize(safeSizeX);
  const segmentsZ = resolveGridSize(safeSizeZ);
  const clampedX = Math.max(0, Math.min(safeSizeX, toFinite(x, 0)));
  const clampedZ = Math.max(0, Math.min(safeSizeZ, toFinite(z, 0)));

  const cellX = (clampedX / safeSizeX) * segmentsX;
  const cellZ = (clampedZ / safeSizeZ) * segmentsZ;
  const x0 = Math.floor(cellX);
  const z0 = Math.floor(cellZ);
  const x1 = Math.min(segmentsX, x0 + 1);
  const z1 = Math.min(segmentsZ, z0 + 1);
  const tx = cellX - x0;
  const tz = cellZ - z0;

  const toWorldX = (ix) => (ix / segmentsX) * safeSizeX;
  const toWorldZ = (iz) => (iz / segmentsZ) * safeSizeZ;

  const h00 = resolveGroundHeightRaw(safeSizeX, safeSizeZ, toWorldX(x0), toWorldZ(z0), proceduralMap);
  const h10 = resolveGroundHeightRaw(safeSizeX, safeSizeZ, toWorldX(x1), toWorldZ(z0), proceduralMap);
  const h01 = resolveGroundHeightRaw(safeSizeX, safeSizeZ, toWorldX(x0), toWorldZ(z1), proceduralMap);
  const h11 = resolveGroundHeightRaw(safeSizeX, safeSizeZ, toWorldX(x1), toWorldZ(z1), proceduralMap);

  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  return hx0 + (hx1 - hx0) * tz;
}

export function buildGroundGeometry(sizeX, sizeZ, proceduralMap = null) {
  const segmentsX = resolveGridSize(sizeX);
  const segmentsZ = resolveGridSize(sizeZ);
  const geometry = new THREE.PlaneGeometry(sizeX, sizeZ, segmentsX, segmentsZ);
  const positions = geometry.attributes.position;
  const safeSizeX = Math.max(1, toFinite(sizeX, 1));
  const safeSizeZ = Math.max(1, toFinite(sizeZ, 1));
  const halfX = safeSizeX / 2;
  const halfZ = safeSizeZ / 2;

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getY(i);
    const worldX = x + halfX;
    const worldZ = z + halfZ;
    positions.setZ(i, resolveGroundHeightRaw(safeSizeX, safeSizeZ, worldX, worldZ, proceduralMap));
  }

  geometry.computeVertexNormals();
  return geometry;
}

export function createGroundSampler(sizeX, sizeZ, proceduralMap = null) {
  return (x, z) => sampleGroundHeight(sizeX, sizeZ, x, z, proceduralMap);
}

export function createGroundSamplerFromMesh(groundMesh, fallbackSampler) {
  const fallback =
    typeof fallbackSampler === "function"
      ? fallbackSampler
      : (x, z) => resolveGroundHeightRaw(100, 100, x, z, null);

  const geometry = groundMesh?.geometry ?? null;
  const positions = geometry?.attributes?.position ?? null;
  const width = Number(geometry?.parameters?.width);
  const height = Number(geometry?.parameters?.height);
  const segmentsX = Number(geometry?.parameters?.widthSegments);
  const segmentsZ = Number(geometry?.parameters?.heightSegments);

  if (
    !groundMesh ||
    !positions ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0 ||
    !Number.isInteger(segmentsX) ||
    segmentsX <= 0 ||
    !Number.isInteger(segmentsZ) ||
    segmentsZ <= 0
  ) {
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

  const xSlope = (right - left) / (2 * delta);
  const zSlope = (front - back) / (2 * delta);

  return {
    pitch: THREE.MathUtils.clamp(-zSlope * 1.05, -0.28, 0.28),
    roll: THREE.MathUtils.clamp(xSlope * 1.05, -0.28, 0.28),
  };
}
