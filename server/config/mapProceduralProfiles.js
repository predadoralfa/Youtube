"use strict";

const PROCEDURAL_MAP_PROFILES = {
  3: {
    mapCode: "MONTIVALES_TUTORIAL",
    mapName: "Montivalles",
    localId: 16,
    instanceId: 3,
    worldSeed: 1603001,
    chunkSize: 256,
    chunkRadius: 1,
    size: {
      x: 10000,
      z: 100000,
    },
    profile: {
      code: "temperate_forest_tutorial",
      theme: "tutorial_forest",
      climate: "mild",
      dominantVisualFamily: "temperate_forest",
      allowedBiomeFamilies: ["forest", "grassland", "rocky"],
      edgeBarrier: "cliff_and_forest_wall",
    },
    terrain: {
      heightAmplitude: 15,
      roughness: 0.35,
      plateauRatio: 0.25,
      slopeLimit: 0.7,
      valleyDepth: 0.2,
    },
    biomes: [
      {
        code: "tutorial_start",
        area: "start_zone",
        weight: 1,
      },
      {
        code: "forest",
        area: "main_corridor",
        weight: 3,
      },
      {
        code: "rocky",
        area: "edge_band",
        weight: 2,
      },
    ],
    scatter: {
      treeDensity: 0.7,
      rockDensity: 0.35,
      grassDensity: 0.9,
      minDistanceBetweenLargeAssets: 12,
      maxSlope: 0.5,
      minDistanceFromEdge: 24,
    },
    edgeBarrier: {
      kind: "cliff_and_forest_wall",
      minHeight: 18,
      blockerFamily: "temperate_forest",
    },
    zones: {
      safeStart: {
        enabled: true,
        radius: 35,
      },
      reserved: [
        {
          code: "starter_path",
          shape: "corridor",
          priority: 10,
        },
      ],
    },
    specialPoints: [
      {
        code: "apple_tree_01",
        kind: "resource_node",
        placementRule: "near_start_path",
      },
      {
        code: "apple_tree_02",
        kind: "resource_node",
        placementRule: "near_start_path",
      },
    ],
    assetFamilies: ["temperate_forest", "prairie", "cold_mountain"],
  },
};

function getProceduralMapProfile(instanceOrLocalId) {
  const key = Number(instanceOrLocalId ?? 0);
  const profile = PROCEDURAL_MAP_PROFILES[key] ?? null;
  if (!profile) return null;

  return {
    ...profile,
    size: { ...profile.size },
    profile: { ...profile.profile },
    terrain: { ...profile.terrain },
    biomes: profile.biomes.map((biome) => ({ ...biome })),
    scatter: { ...profile.scatter },
    edgeBarrier: { ...profile.edgeBarrier },
    zones: {
      safeStart: { ...profile.zones.safeStart },
      reserved: profile.zones.reserved.map((zone) => ({ ...zone })),
    },
    specialPoints: profile.specialPoints.map((point) => ({ ...point })),
    assetFamilies: [...profile.assetFamilies],
  };
}

module.exports = {
  getProceduralMapProfile,
};
