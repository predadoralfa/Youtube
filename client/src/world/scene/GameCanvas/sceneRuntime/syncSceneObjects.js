import { createSceneObjectMesh } from "../../../entities/objects/ObjectFactory";
import { readPosYawFromEntity } from "../helpers";

export function syncSceneObjectMeshes({ sceneObjects, scene, state, sampleGroundHeight }) {
  const nextObjectIds = new Set();

  for (const sceneObject of sceneObjects) {
    if (String(sceneObject?.status ?? "ACTIVE").toUpperCase() !== "ACTIVE") {
      continue;
    }

    const objectId = String(sceneObject.id);
    nextObjectIds.add(objectId);

    let mesh = state.meshBySceneObjectIdRef.current.get(objectId);
    if (!mesh) {
      mesh = createSceneObjectMesh(sceneObject);
      mesh.userData.kind = mesh.userData.kind ?? "OBJECT";
      mesh.userData.objectId = mesh.userData.objectId ?? objectId;
      mesh.userData.objectType =
        mesh.userData.objectType ?? sceneObject.objectType ?? sceneObject.object_type ?? null;
      mesh.userData.displayName =
        sceneObject.displayName ?? sceneObject.display_name ?? sceneObject.objectType ?? sceneObject.object_type ?? null;
      state.meshBySceneObjectIdRef.current.set(objectId, mesh);
      scene.add(mesh);
    }

    mesh.userData.displayName =
      sceneObject.displayName ?? sceneObject.display_name ?? sceneObject.objectType ?? sceneObject.object_type ?? null;

    const { x, y, z, yaw } = readPosYawFromEntity(sceneObject);
    const scale = sceneObject?.scale ?? sceneObject?.scale_x ?? null;
    const groundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(x, z) : 0);
    const offsetY = Number(y ?? 0);
    mesh.position.set(x, groundY + offsetY, z);
    mesh.rotation.y = yaw ?? 0;

    const scaleX = Number(scale?.x ?? sceneObject?.scaleX ?? sceneObject?.scale_x ?? 1);
    const scaleY = Number(scale?.y ?? sceneObject?.scaleY ?? sceneObject?.scale_y ?? 1);
    const scaleZ = Number(scale?.z ?? sceneObject?.scaleZ ?? sceneObject?.scale_z ?? 1);
    mesh.scale.set(
      Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
      Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1,
      Number.isFinite(scaleZ) && scaleZ > 0 ? scaleZ : 1
    );
  }

  for (const [objectId, mesh] of state.meshBySceneObjectIdRef.current.entries()) {
    if (nextObjectIds.has(objectId)) continue;

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
    state.meshBySceneObjectIdRef.current.delete(objectId);
  }
}
