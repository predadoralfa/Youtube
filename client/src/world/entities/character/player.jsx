export {
  MAN_ANIMATION_CATALOG,
  createPlayerMesh,
  disposePlayerMesh,
  loadManTemplate,
  updatePlayerMeshAnimation,
} from "./manModel";

export function syncPlayer(mesh, runtime) {
  const x = runtime?.pos?.x ?? 0;
  const z = runtime?.pos?.z ?? 0;
  const yaw = runtime?.yaw ?? 0;

  mesh.position.x = x;
  mesh.position.z = z;
  mesh.rotation.y = yaw;
}
