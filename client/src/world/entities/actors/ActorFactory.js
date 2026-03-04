/**
 * ActorFactory.js
 * 
 * Factories para criar meshes de actors (Three.js puro)
 * Baseado nos tipos: CHEST, TREE, NPC, DEFAULT
 */
import * as THREE from "three";

/**
 * Cria um mesh para CHEST (baú)
 */
export function createChestMesh(actor) {
  const group = new THREE.Group();

  // Corpo (caixa)
  const bodyGeo = new THREE.BoxGeometry(1.5, 1, 1.5);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // marrom
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = 0.5;
  group.add(body);

  // Tampa (lid)
  const lidGeo = new THREE.BoxGeometry(1.5, 0.3, 1.5);
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x654321 }); // marrom escuro
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.castShadow = true;
  lid.receiveShadow = true;
  lid.position.y = 1.15;
  group.add(lid);

  // Metal bands (opcional)
  const bandGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
  
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.castShadow = true;
    band.position.y = 0.3 + i * 0.4;
    group.add(band);
  }

  group.castShadow = true;
  group.receiveShadow = true;
  group.userData = {
    actorId: actor.id,
    actorType: actor.actorType,
    interactive: true,
  };

  return group;
}

/**
 * Cria um mesh para TREE (árvore)
 */
export function createTreeMesh(actor) {
  const group = new THREE.Group();

  // Tronco
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 3, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x654321 }); // marrom
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.position.y = 1.5;
  group.add(trunk);

  // Folhagem (3 esferas empilhadas)
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // verde floresta
  const foliageSizes = [
    { radius: 1.5, y: 3.5 },
    { radius: 1.2, y: 4.2 },
    { radius: 0.9, y: 4.8 },
  ];

  for (const { radius, y } of foliageSizes) {
    const foliageGeo = new THREE.SphereGeometry(radius, 8, 8);
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    foliage.position.y = y;
    group.add(foliage);
  }

  group.castShadow = true;
  group.receiveShadow = true;
  group.userData = {
    actorId: actor.id,
    actorType: actor.actorType,
    interactive: false,
  };

  return group;
}

/**
 * Cria um mesh para NPC (humanóide)
 */
export function createNPCMesh(actor) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4169E1 }); // azul royal

  // Cabeça
  const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const head = new THREE.Mesh(headGeo, mat);
  head.castShadow = true;
  head.position.y = 1.7;
  group.add(head);

  // Corpo (cilindro)
  const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.castShadow = true;
  body.position.y = 1.1;
  group.add(body);

  // Pernas (2 cilindros)
  const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 6);
  
  for (let i = -1; i <= 1; i += 2) {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.castShadow = true;
    leg.position.x = i * 0.2;
    leg.position.y = 0.3;
    group.add(leg);
  }

  group.castShadow = true;
  group.receiveShadow = true;
  group.userData = {
    actorId: actor.id,
    actorType: actor.actorType,
    interactive: true,
  };

  return group;
}

/**
 * Cria um mesh DEFAULT (fallback - cubo)
 */
export function createDefaultMesh(actor) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xFF1493 }); // rosa (debug)
  const mesh = new THREE.Mesh(geo, mat);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    actorId: actor.id,
    actorType: actor.actorType,
    interactive: false,
  };

  return mesh;
}

/**
 * Factory principal: cria mesh baseado em actorType
 */
export function createActorMesh(actor) {
  switch (actor.actorType) {
    case "CHEST":
      return createChestMesh(actor);
    case "TREE":
      return createTreeMesh(actor);
    case "NPC":
      return createNPCMesh(actor);
    default:
      return createDefaultMesh(actor);
  }
}