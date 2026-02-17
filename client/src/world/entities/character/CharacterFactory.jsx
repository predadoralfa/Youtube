// src/world/entities/character/CharacterEntity.js
import * as THREE from "three";

export class CharacterEntity {
  constructor() {
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 2.0, 16);
    const mat = new THREE.MeshStandardMaterial();
    this.mesh = new THREE.Mesh(geo, mat);

    this.mesh.castShadow = true;
    this.mesh.position.y = 1.0;
  }

  sync(runtime) {
    const x = runtime?.pos?.x ?? 0;
    const z = runtime?.pos?.z ?? 0;
    const yaw = runtime?.yaw ?? 0;

    this.mesh.position.x = x;
    this.mesh.position.z = z;
    this.mesh.rotation.y = yaw;
  }
}
