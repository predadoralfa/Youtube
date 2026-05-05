function toFiniteNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clampMin(value, min) {
  const next = toFiniteNumber(value, min);
  return Math.max(min, next);
}

function serializeTerrainState(snapshot) {
  const template = snapshot?.localTemplate ?? {};
  const geometry = template?.geometry ?? {};
  const visual = template?.visual ?? {};
  const proceduralMap = snapshot?.proceduralMap ?? {};
  const terrain = proceduralMap?.terrain ?? {};
  const scatter = proceduralMap?.scatter ?? {};

  return [
    Number(geometry?.size_x ?? 100),
    Number(geometry?.size_z ?? 100),
    String(visual?.ground_render_material?.base_color ?? visual?.ground_color ?? "#5a5a5a"),
    Number(proceduralMap?.worldSeed ?? 1337),
    Number(proceduralMap?.chunkSize ?? 256),
    Number(proceduralMap?.chunkRadius ?? 1),
    Number(terrain?.heightAmplitude ?? 1),
    Number(terrain?.roughness ?? 1),
    Number(terrain?.plateauRatio ?? 0),
    Number(terrain?.slopeLimit ?? 1),
    Number(terrain?.valleyDepth ?? 0),
    Number(scatter?.grassDensity ?? 0.9),
    Number(scatter?.treeDensity ?? 0.7),
    Number(scatter?.rockDensity ?? 0.35),
    Number(scatter?.maxSlope ?? 0.5),
  ].join("|");
}

export function getTerrainDraftSignature(draft) {
  if (!draft) return "";
  return [
    Number(draft?.sizeX ?? 100),
    Number(draft?.sizeZ ?? 100),
    String(draft?.groundColor ?? "#5a5a5a"),
    Number(draft?.worldSeed ?? 1337),
    Number(draft?.chunkSize ?? 256),
    Number(draft?.chunkRadius ?? 1),
    Number(draft?.heightAmplitude ?? 1),
    Number(draft?.roughness ?? 1),
    Number(draft?.plateauRatio ?? 0),
    Number(draft?.slopeLimit ?? 1),
    Number(draft?.valleyDepth ?? 0),
    Number(draft?.grassDensity ?? 0.9),
    Number(draft?.treeDensity ?? 0.7),
    Number(draft?.rockDensity ?? 0.35),
    Number(draft?.maxSlope ?? 0.5),
  ].join("|");
}

export function buildTerrainDraftFromSnapshot(snapshot) {
  const template = snapshot?.localTemplate ?? {};
  const geometry = template?.geometry ?? {};
  const visual = template?.visual ?? {};
  const proceduralMap = snapshot?.proceduralMap ?? {};
  const terrain = proceduralMap?.terrain ?? {};
  const scatter = proceduralMap?.scatter ?? {};

  return {
    sizeX: String(geometry?.size_x ?? 100),
    sizeZ: String(geometry?.size_z ?? 100),
    groundColor: String(visual?.ground_render_material?.base_color ?? visual?.ground_color ?? "#5a5a5a"),
    worldSeed: String(proceduralMap?.worldSeed ?? 1337),
    chunkSize: String(proceduralMap?.chunkSize ?? 256),
    chunkRadius: String(proceduralMap?.chunkRadius ?? 1),
    heightAmplitude: String(terrain?.heightAmplitude ?? 1),
    roughness: String(terrain?.roughness ?? 1),
    plateauRatio: String(terrain?.plateauRatio ?? 0),
    slopeLimit: String(terrain?.slopeLimit ?? 1),
    valleyDepth: String(terrain?.valleyDepth ?? 0),
    grassDensity: String(scatter?.grassDensity ?? 0.9),
    treeDensity: String(scatter?.treeDensity ?? 0.7),
    rockDensity: String(scatter?.rockDensity ?? 0.35),
    maxSlope: String(scatter?.maxSlope ?? 0.5),
  };
}

export function getTerrainSignature(snapshot) {
  return serializeTerrainState(snapshot);
}

export function applyTerrainDraftToSnapshot(prevSnapshot, draft) {
  if (!prevSnapshot || !draft) return prevSnapshot;

  const nextSizeX = clampMin(draft.sizeX, 1);
  const nextSizeZ = clampMin(draft.sizeZ, 1);
  const nextGroundColor = String(draft.groundColor ?? "#5a5a5a");

  const prevLocalTemplate = prevSnapshot?.localTemplate ?? {};
  const prevVisual = prevLocalTemplate?.visual ?? {};
  const prevProceduralMap = prevSnapshot?.proceduralMap ?? {};
  const prevTerrain = prevProceduralMap?.terrain ?? {};
  const prevScatter = prevProceduralMap?.scatter ?? {};

  const nextProceduralMap = {
    ...prevProceduralMap,
    size: {
      ...(prevProceduralMap?.size ?? {}),
      x: nextSizeX,
      z: nextSizeZ,
    },
    worldSeed: Math.round(clampMin(draft.worldSeed, 0)),
    chunkSize: Math.round(clampMin(draft.chunkSize, 64)),
    chunkRadius: Math.round(clampMin(draft.chunkRadius, 0)),
    terrain: {
      ...prevTerrain,
      heightAmplitude: clampMin(draft.heightAmplitude, 0),
      roughness: clampMin(draft.roughness, 0),
      plateauRatio: clampMin(draft.plateauRatio, 0),
      slopeLimit: clampMin(draft.slopeLimit, 0),
      valleyDepth: clampMin(draft.valleyDepth, 0),
    },
    scatter: {
      ...prevScatter,
      grassDensity: clampMin(draft.grassDensity, 0),
      treeDensity: clampMin(draft.treeDensity, 0),
      rockDensity: clampMin(draft.rockDensity, 0),
      maxSlope: clampMin(draft.maxSlope, 0),
    },
  };

  return {
    ...prevSnapshot,
    localTemplate: {
      ...prevLocalTemplate,
      geometry: {
        ...(prevLocalTemplate?.geometry ?? {}),
        size_x: nextSizeX,
        size_z: nextSizeZ,
      },
      visual: {
        ...prevVisual,
        ground_color: nextGroundColor,
        ground_render_material: {
          ...(prevVisual?.ground_render_material ?? {}),
          base_color: nextGroundColor,
        },
      },
    },
    proceduralMap: nextProceduralMap,
  };
}
