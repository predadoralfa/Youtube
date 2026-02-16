import { useEffect, useRef } from "react";
import * as THREE from "three";
import { setupCamera } from "./camera/camera";
import { setupLight } from "./light/light";

export function GameCanvas({ snapshot }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sizeX = snapshot?.localTemplate?.geometry?.size_x ?? 200;
    const sizeZ = snapshot?.localTemplate?.geometry?.size_z ?? 200;
    const visual = snapshot?.localTemplate?.visual ?? {};

    // =============================
    // RENDERER
    // =============================
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;

    container.appendChild(renderer.domElement);

    // =============================
    // SCENE
    // =============================
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // =============================
    // CAMERA + LIGHT
    // =============================
    const { camera, update, onWheel, onResize, setBounds } =
      setupCamera(container);

    setupLight(scene);
    setBounds({ sizeX, sizeZ });

    renderer.domElement.addEventListener("wheel", onWheel, {
      passive: false,
    });
    window.addEventListener("resize", onResize);

    // =============================
    // MATERIAL VISUAL DO CHÃO
    // =============================
    const color =
      visual?.ground_render_material?.base_color ??
      visual?.ground_color ??
      "#5a5a5a";

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
    });

    // =============================
    // CHÃO VISÍVEL (plataforma real)
    // =============================
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeX, sizeZ),
      groundMaterial
    );

    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // =============================
    // COLISOR INVISÍVEL (conceito mantido)
    // =============================
    const groundCollider = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeX, sizeZ),
      new THREE.MeshBasicMaterial({ visible: false })
    );

    groundCollider.rotation.x = -Math.PI / 2;
    scene.add(groundCollider);

    // =============================
    // LIMITES (LineLoop)
    // =============================
    const halfX = sizeX / 2;
    const halfZ = sizeZ / 2;
    const y = 0.2;

    const pts = [
      new THREE.Vector3(-halfX, y, -halfZ),
      new THREE.Vector3(halfX, y, -halfZ),
      new THREE.Vector3(halfX, y, halfZ),
      new THREE.Vector3(-halfX, y, halfZ),
    ];

    const boundsGeometry = new THREE.BufferGeometry().setFromPoints(pts);
    const boundsMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const bounds = new THREE.LineLoop(boundsGeometry, boundsMaterial);
    bounds.frustumCulled = false;
    scene.add(bounds);

    // =============================
    // LOOP
    // =============================
    let alive = true;
    const clock = new THREE.Clock();

    const tick = () => {
      if (!alive) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      update(null, dt);

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    // =============================
    // CLEANUP
    // =============================
    return () => {
      alive = false;

      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);

      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      renderer.dispose();

      groundMesh.geometry.dispose();
      groundMesh.material.dispose();

      groundCollider.geometry.dispose();

      boundsGeometry.dispose();
      boundsMaterial.dispose();
    };
  }, [snapshot]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
}
