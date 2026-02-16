import * as THREE from "three";

/**
 * Luz padrão do laboratório.
 * Responsável apenas por tornar a cena visível.
 * Não depende de backend.
 * Não contém regra de gameplay.
 */
export function setupLight(scene) {
  if (!scene) {
    throw new Error("setupLight: scene é obrigatória");
  }

  // =============================
  // 1) Luz ambiente hemisférica
  // =============================
  const hemiLight = new THREE.HemisphereLight(
    0xffffff, // cor do céu
    0x222222, // cor do chão
    1.0       // intensidade
  );

  scene.add(hemiLight);

  // =============================
  // 2) Luz direcional (sol fake)
  // =============================
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);

  // posição elevada, levemente inclinada
  dirLight.position.set(15, 25, 10);

  dirLight.castShadow = false; // sombras ficam para depois
  scene.add(dirLight);

  // =============================
  // 3) Retorno estruturado
  // =============================
  return {
    hemiLight,
    dirLight
  };
}
