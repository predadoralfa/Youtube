const EDITOR_CHARACTER_ID = "__scene_creator_character__";
const EDITOR_CHARACTER_CODE = "EDITOR_CHARACTER";

function createPos(pos = {}) {
  return {
    x: Number(pos.x ?? 0),
    y: Number(pos.y ?? 0),
    z: Number(pos.z ?? 0),
  };
}

export function createEditorCharacter(pos = {}, yaw = 0) {
  const nextPos = createPos(pos);
  return {
    id: EDITOR_CHARACTER_ID,
    status: "ACTIVE",
    objectDefCode: EDITOR_CHARACTER_CODE,
    objectType: EDITOR_CHARACTER_CODE,
    assetKey: EDITOR_CHARACTER_CODE,
    displayName: "GM Character",
    pos: nextPos,
    yaw: Number(yaw ?? 0),
    scale: {
      x: 0.9,
      y: 1.9,
      z: 0.9,
    },
    localOnly: true,
    editorOnly: true,
  };
}

export function isEditorCharacter(entry) {
  if (!entry) return false;
  return (
    String(entry.id ?? "") === EDITOR_CHARACTER_ID ||
    String(entry.objectDefCode ?? entry.objectType ?? entry.assetKey ?? "").toUpperCase() === EDITOR_CHARACTER_CODE
  );
}

export function syncEditorCharacter(snapshot, pos = {}, yaw = 0) {
  if (!snapshot) return snapshot;

  const sceneObjects = Array.isArray(snapshot.sceneObjects) ? snapshot.sceneObjects : [];
  const filtered = sceneObjects.filter((entry) => !isEditorCharacter(entry));
  filtered.unshift(createEditorCharacter(pos, yaw));

  return {
    ...snapshot,
    sceneObjects: filtered,
    runtime: {
      ...(snapshot.runtime ?? null),
      pos: createPos(pos),
    },
  };
}

export function getEditorCharacterId() {
  return EDITOR_CHARACTER_ID;
}
