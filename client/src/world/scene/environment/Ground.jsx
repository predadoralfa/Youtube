/**
 * Ground.jsx
 *
 * Renderiza ambiente estático:
 * - Chão (plano principal)
 * - Grid de debug
 * - Eixos de debug
 * - Limites visuais (bounds)
 *
 * Props:
 * - snapshot: { localTemplate, ... }
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";

export function Ground({ snapshot }) {
  const groupRef = useRef();

  const localTemplate = snapshot?.localTemplate;
  const sizeX = localTemplate?.geometry?.size_x ?? 200;
  const sizeZ = localTemplate?.geometry?.size_z ?? 200;
  const visual = localTemplate?.visual ?? {};
  const groundColor =
    visual?.ground_render_material?.base_color ??
    visual?.ground_color ??
    "#5a5a5a";

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (groupRef.current) {
        groupRef.current.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, []);

  return (
    <group ref={groupRef} name="environment-ground">
      {/* ✅ Chão principal */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[sizeX, sizeZ]} />
        <meshStandardMaterial color={groundColor} />
      </mesh>

      {/* ✅ Grid de debug (linhas) */}
      <gridHelper 
        args={[Math.max(sizeX, sizeZ), 20]} 
        position={[0, 0.01, 0]} 
      />

      {/* ✅ Eixos de debug (RGB: X=red, Y=green, Z=blue) */}
      <axesHelper args={[10]} position={[0, 0.02, 0]} />

      {/* ✅ Limites visuais (bounds do mundo) */}
      <BoundsVisual sizeX={sizeX} sizeZ={sizeZ} />
    </group>
  );
}

/**
 * BoundsVisual: renderiza linhas dos limites do mundo
 */
function BoundsVisual({ sizeX, sizeZ }) {
  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;
  const yLine = 0.2;

  // Pontos dos 4 cantos do mundo
  const points = [
    new THREE.Vector3(-halfX, yLine, -halfZ),
    new THREE.Vector3(halfX, yLine, -halfZ),
    new THREE.Vector3(halfX, yLine, halfZ),
    new THREE.Vector3(-halfX, yLine, halfZ),
  ];

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <lineLoop args={[geometry]} frustumCulled={false}>
      <lineBasicMaterial color={0xffffff} />
    </lineLoop>
  );
}