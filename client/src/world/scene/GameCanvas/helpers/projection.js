const COLOR_SELF = "#ff2d55";
const COLOR_OTHER = "#2d7dff";

export function applySelfColor(mesh, isSelf) {
  if (!mesh) return;

  const color = isSelf ? COLOR_SELF : COLOR_OTHER;
  mesh.userData.isSelf = !!isSelf;

  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const entry of material) {
      if (entry?.color) entry.color.set(color);
    }
  } else if (material?.color) {
    material.color.set(color);
  }
}

export function pickTargetFromHitObject(obj) {
  let current = obj;
  while (current) {
    const userData = current.userData || {};

    if (userData.actorId != null) {
      return {
        kind: "ACTOR",
        id: String(userData.actorId),
        actorType: userData.actorType ? String(userData.actorType) : null,
      };
    }

    if (userData.kind === "ENEMY" && userData.entityId != null) {
      return { kind: "ENEMY", id: String(userData.entityId) };
    }

    if (userData.playerId != null) {
      return { kind: "PLAYER", id: String(userData.playerId) };
    }

    if (userData.kind === "PLAYER" && userData.entityId != null) {
      return { kind: "PLAYER", id: String(userData.entityId) };
    }

    current = current.parent;
  }

  return null;
}

export function projectWorldToScreenPx(worldPos, camera, domElement) {
  const rect = domElement.getBoundingClientRect();
  const v = worldPos.clone().project(camera);

  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || v.z < -1 || v.z > 1) {
    return null;
  }

  return {
    x: (v.x * 0.5 + 0.5) * rect.width,
    y: (-v.y * 0.5 + 0.5) * rect.height,
  };
}
