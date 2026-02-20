// src/world/entities/character/player.jsx
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * PLAYER (Placeholder)
 *
 * Papel:
 * Representar visualmente o jogador na cena (placeholder temporário).
 *
 * Fonte da verdade:
 * Snapshot do backend (runtime recebido pelo GameShell/GameCanvas).
 *
 * Faz:
 * - Cria um cilindro em pé (mesh Three.js)
 * - Expõe API mínima para o GameCanvas sincronizar posição/rotação
 *
 * Não faz:
 * - Não lê teclado
 * - Não calcula movimento
 * - Não aplica física
 * - Não faz HTTP
 */

const COLORS = {
  self: "#ff2d55",
  other: "#2d7dff",
};

export function createPlayerMesh(
  {
    radius = 0.5,
    height = 1.75,
    color,
    isSelf = true,
  } = {}
) {
  // Se não foi passado color explícito, escolhe por categoria (self vs other)
  const resolvedColor = color ?? (isSelf ? COLORS.self : COLORS.other);

  const geo = new THREE.CylinderGeometry(radius, radius, height, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(resolvedColor),
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = false;

  // “pisa” no chão
  mesh.position.y = height / 2;

  // marcação útil para debug (sem depender de nomeplate ainda)
  mesh.userData.isSelf = !!isSelf;

  return mesh;
}

export function syncPlayer(mesh, runtime) {
  const x = runtime?.pos?.x ?? 0;
  const z = runtime?.pos?.z ?? 0;
  const yaw = runtime?.yaw ?? 0;

  mesh.position.x = x;
  mesh.position.z = z;
  mesh.rotation.y = yaw;
}