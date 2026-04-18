import { createActorMesh } from "../../../entities/actors/ActorFactory";
import { readPosYawFromEntity } from "../helpers";

export function syncActorMeshes({ actors, scene, state, clearSelection, sampleGroundHeight }) {
  const nextActorIds = new Set();

  for (const actor of actors) {
    const actorId = String(actor.id);
    nextActorIds.add(actorId);

    let mesh = state.meshByActorIdRef.current.get(actorId);
    if (!mesh) {
      mesh = createActorMesh(actor);
      mesh.userData.kind = mesh.userData.kind ?? "ACTOR";
      mesh.userData.actorId = mesh.userData.actorId ?? actorId;
      mesh.userData.actorType = mesh.userData.actorType ?? actor.actorType ?? actor.actor_type ?? null;
      mesh.userData.displayName =
        actor.displayName ?? actor.display_name ?? actor.actorType ?? actor.actor_type ?? null;
      mesh.userData.lootSummary = actor.lootSummary ?? null;
      state.meshByActorIdRef.current.set(actorId, mesh);
      scene.add(mesh);
    }

    mesh.userData.displayName =
      actor.displayName ?? actor.display_name ?? actor.actorType ?? actor.actor_type ?? null;
    mesh.userData.lootSummary = actor.lootSummary ?? null;

    const { x, y, z, yaw } = readPosYawFromEntity(actor);
    const groundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(x, z) : 0);
    const actorType = String(actor?.actorType ?? actor?.actor_type ?? "").trim().toUpperCase();
    const isTreeActor = actorType === "TREE" || actorType === "TREE_APPLE" || actorType === "APPLE_TREE";
    const actorOffsetY = isTreeActor ? 0 : Number(y ?? 0);
    mesh.position.set(x, groundY + actorOffsetY, z);
    mesh.rotation.y = yaw ?? 0;
  }

  for (const [actorId, mesh] of state.meshByActorIdRef.current.entries()) {
    if (nextActorIds.has(actorId)) continue;

    const selected = state.selectedTargetRef.current;
    if (selected?.kind === "ACTOR" && String(selected.id) === String(actorId)) {
      clearSelection();
    }

    scene.remove(mesh);
    try {
      mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    } catch {}
    state.meshByActorIdRef.current.delete(actorId);
  }
}
