function toId(value) {
  if (value == null) return null;
  const next = String(value).trim();
  return next ? next : null;
}

export function mergeSnapshotActor(prevSnapshot, actorUpdate) {
  if (!prevSnapshot || !actorUpdate) return prevSnapshot;

  const actorId = toId(actorUpdate?.id ?? actorUpdate?.actorId ?? actorUpdate?.actor?.id ?? null);
  if (!actorId) return prevSnapshot;

  const nextActorPatch = actorUpdate?.actor ?? actorUpdate;
  const actors = Array.isArray(prevSnapshot.actors) ? prevSnapshot.actors : [];
  let changed = false;
  let found = false;

  const nextActors = actors.map((actor) => {
    if (toId(actor?.id ?? null) !== actorId) return actor;
    found = true;
    changed = true;
    return {
      ...actor,
      ...nextActorPatch,
      id: actor?.id ?? nextActorPatch?.id ?? actorId,
    };
  });

  if (!found) {
    changed = true;
    nextActors.push({
      id: nextActorPatch?.id ?? actorId,
      ...nextActorPatch,
    });
  }

  if (!changed) return prevSnapshot;

  return {
    ...prevSnapshot,
    actors: nextActors,
  };
}

export function mergeSnapshotSceneObject(prevSnapshot, sceneObjectUpdate) {
  if (!prevSnapshot || !sceneObjectUpdate) return prevSnapshot;

  const sceneObjectId = toId(
    sceneObjectUpdate?.id ??
      sceneObjectUpdate?.sceneObjectId ??
      sceneObjectUpdate?.sceneObject?.id ??
      null
  );
  if (!sceneObjectId) return prevSnapshot;

  const nextPatch = sceneObjectUpdate?.sceneObject ?? sceneObjectUpdate;
  const sceneObjects = Array.isArray(prevSnapshot.sceneObjects) ? prevSnapshot.sceneObjects : [];
  let changed = false;
  let found = false;

  const nextSceneObjects = sceneObjects.map((sceneObject) => {
    if (toId(sceneObject?.id ?? null) !== sceneObjectId) return sceneObject;
    found = true;
    changed = true;
    return {
      ...sceneObject,
      ...nextPatch,
      id: sceneObject?.id ?? nextPatch?.id ?? sceneObjectId,
    };
  });

  if (!found) {
    changed = true;
    nextSceneObjects.push({
      id: nextPatch?.id ?? sceneObjectId,
      ...nextPatch,
    });
  }

  if (!changed) return prevSnapshot;

  return {
    ...prevSnapshot,
    sceneObjects: nextSceneObjects,
  };
}
