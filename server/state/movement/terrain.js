"use strict";

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveTerrainHeightRaw(sizeX, sizeZ, x, z) {
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
  return (centerRise + corridorRise + sideRise + waveA + waveB + waveC + waveD + gentleNoise + longRidge) * edgeFade;
}

function resolveGridSize(size) {
  return Math.max(64, Math.min(256, Math.round(size / 120)));
}

function resolveTerrainHeight(sizeX, sizeZ, x, z) {
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

  const h00 = resolveTerrainHeightRaw(safeSizeX, safeSizeZ, toWorldX(x0), toWorldZ(z0));
  const h10 = resolveTerrainHeightRaw(safeSizeX, safeSizeZ, toWorldX(x1), toWorldZ(z0));
  const h01 = resolveTerrainHeightRaw(safeSizeX, safeSizeZ, toWorldX(x0), toWorldZ(z1));
  const h11 = resolveTerrainHeightRaw(safeSizeX, safeSizeZ, toWorldX(x1), toWorldZ(z1));

  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  return hx0 + (hx1 - hx0) * tz;
}

function resolveTerrainHeightFromBounds(bounds, x, z) {
  return resolveTerrainHeight(bounds?.sizeX ?? bounds?.size_x ?? 1, bounds?.sizeZ ?? bounds?.size_z ?? 1, x, z);
}

module.exports = {
  resolveTerrainHeight,
  resolveTerrainHeightFromBounds,
};
