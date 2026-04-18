export function cleanupSceneRuntime({
  scene,
  renderer,
  groundMesh,
  boundsLine,
  boundsGeometry,
  boundsMaterial,
  proceduralWorldGroup,
  onResize,
  state,
}) {
  window.removeEventListener("resize", onResize);

  const canvas = renderer.domElement;
  if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }

  for (const [, mesh] of state.meshByEntityIdRef.current.entries()) {
    scene.remove(mesh);
    try {
      mesh.geometry?.dispose?.();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) material?.dispose?.();
      } else {
        mesh.material?.dispose?.();
      }
    } catch {}
  }
  state.meshByEntityIdRef.current.clear();

  for (const [, mesh] of state.meshByEnemyIdRef.current.entries()) {
    scene.remove(mesh);
    try {
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
    } catch {}
  }
  state.meshByEnemyIdRef.current.clear();

  for (const [, mesh] of state.meshByActorIdRef.current.entries()) {
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
  }
  state.meshByActorIdRef.current.clear();

  if (proceduralWorldGroup) {
    scene.remove(proceduralWorldGroup);
    proceduralWorldGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (const material of child.material) material?.dispose?.();
        } else {
          child.material.dispose?.();
        }
      }
    });
  }

  renderer.dispose();
  groundMesh.geometry.dispose();
  groundMesh.material.dispose();
  if (boundsLine) {
    boundsLine.geometry?.dispose?.();
    if (Array.isArray(boundsLine.material)) {
      for (const material of boundsLine.material) material?.dispose?.();
    } else {
      boundsLine.material?.dispose?.();
    }
  } else {
    boundsGeometry.dispose();
    boundsMaterial.dispose();
  }

  state.selectedTargetRef.current = null;
  state.selectedObjectRef.current = null;
  state.entityVitalsRef.current.clear();
  state.entityPositionsRef.current.clear();
  state.seenDamageEventIdsRef.current.clear();
  state.cameraRef.current = null;

  state.setMarker({ visible: false, x: 0, y: 0 });
  state.setTargetHpBar(null);
  state.setTargetPlayerCard(null);
  state.setTargetLootCard(null);
  state.setSelfHpBar(null);
}
