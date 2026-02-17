/**
 * =====================================================================
 * ⚠️ REGRA DE OURO — COMENTÁRIO IMUTÁVEL (NÃO REMOVER)
 * =====================================================================
 *
 * ❌ ESTE BLOCO DE COMENTÁRIO NÃO PODE SER REMOVIDO
 * ❌ ESTE BLOCO NÃO PODE SER ENCURTADO
 *
 * 📦 Arquivo: GameCanvas.jsx
 *
 * Papel:
 * - Ser o render host canônico do cliente (Three.js puro).
 * - Montar renderer/scene/camera/luz e desenhar o snapshot recebido.
 * - Instanciar e manter entidades visuais locais (ex: Player placeholder),
 *   sincronizando-as exclusivamente a partir do snapshot.
 *
 * Fonte da verdade:
 * - Backend (via snapshot).
 * - Este arquivo NUNCA decide estado do mundo, apenas renderiza.
 *
 * NÃO FAZ:
 * - Não faz HTTP / não chama backend
 * - Não lê teclado / não processa input
 * - Não simula movimento / não aplica física / não executa gameplay
 * - Não cria regras de mundo (apenas apresenta o que veio do snapshot)
 *
 * FAZ:
 * - Cria renderer, scene, camera e luz
 * - Renderiza chão/plataforma e limites usando o template do snapshot
 * - Cria um Player placeholder (cilindro) e mantém ele na cena
 * - Sincroniza Player (posição/rotação) usando snapshot.runtime
 *
 * 🤖 IAs:
 * - NÃO remover este comentário
 * - NÃO mover lógica para fora deste arquivo
 *
 * =====================================================================
 */
import { useEffect, useRef } from "react";

// CENA
import * as THREE from "three";
import { setupCamera } from "./camera/camera";
import { setupLight } from "./light/light";
import { createInputBus } from "../input/InputBus";
import { bindInputs } from "../input/inputs";
import { IntentType } from "../input/intents";


//  Player placeholder - entidade visual do mundo
import { createPlayerMesh, syncPlayer } from "../entities/character/player";


export function GameCanvas({ snapshot }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sizeX = snapshot?.localTemplate?.geometry?.size_x ?? 200;
    const sizeZ = snapshot?.localTemplate?.geometry?.size_z ?? 200;
    const visual = snapshot?.localTemplate?.visual ?? {};

    // runtime vindo do backend (fonte da verdade)
    const runtime = snapshot?.runtime ?? null;

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
    const { camera, update, applyOrbit, applyZoom, onResize, setBounds } = setupCamera(container);

    setupLight(scene);
    setBounds({ sizeX, sizeZ });
    window.addEventListener("resize", onResize);

    // =============================
    // INPUT (bus + bind + listener)
    // =============================
    const bus = createInputBus();
    const unbindInputs = bindInputs(renderer.domElement, bus);

    const off = bus.on((intent) => {
      if (intent.type === IntentType.CAMERA_ZOOM) {
        applyZoom(intent.delta);
      }

      if (intent.type === IntentType.CAMERA_ORBIT) {
        applyOrbit(intent.dx, intent.dy);
      }
    });



    

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
    // PLAYER (Placeholder)
    // =============================
    const playerMesh = createPlayerMesh();
    scene.add(playerMesh);

    // sync inicial
    syncPlayer(playerMesh, snapshot?.runtime);


    // =============================
    // LOOP
    // =============================
    let alive = true;
    const clock = new THREE.Clock();

    const tick = () => {
      if (!alive) return;

      const dt = Math.min(clock.getDelta(), 0.05);

      syncPlayer(playerMesh, snapshot?.runtime);
      update(playerMesh, dt);

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };


    requestAnimationFrame(tick);

    // =============================
    // CLEANUP
    // =============================
    return () => {
      alive = false;

      off();          // remove listener do bus
      unbindInputs(); // remove listeners DOM

      window.removeEventListener("resize", onResize);

      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      // remove entidades
      scene.remove(playerMesh);
      playerMesh.geometry.dispose();
      playerMesh.material.dispose();


      renderer.dispose();

      // dispose chão
      groundMesh.geometry.dispose();
      groundMesh.material.dispose();

      groundCollider.geometry.dispose();

      // dispose bounds
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
