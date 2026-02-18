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
 * - Converter inputs (via InputBus) em INTENÇÕES que são enviadas ao backend
 *   via Socket.IO, sem simular estado do mundo localmente.
 *
 * Fonte da verdade:
 * - Backend (snapshot inicial + atualizações confirmadas via socket).
 * - Este arquivo NUNCA decide estado do mundo, apenas renderiza e envia intenção.
 *
 * NÃO FAZ:
 * - Não faz HTTP / não chama backend
 * - Não simula movimento / não aplica física / não executa gameplay
 * - Não cria regras de mundo (apenas apresenta o que veio do snapshot)
 * - Não aplica posição final do player (posição vem confirmada do servidor)
 *
 * FAZ:
 * - Cria renderer, scene, camera e luz
 * - Renderiza chão/plataforma e limites usando o template do snapshot
 * - Cria um Player placeholder (cilindro) e mantém ele na cena
 * - Sincroniza Player (posição/rotação) usando runtime confirmado
 * - Lê intents do InputBus:
 *   - CAMERA_ZOOM / CAMERA_ORBIT: afetam apenas a câmera local
 *   - MOVE_DIRECTION: envia "move:intent" para o backend com { dir, dt }
 *
 * 🤖 IAs:
 * - NÃO remover este comentário
 * - NÃO mover lógica para fora deste arquivo
 * - NÃO introduzir simulação local do mundo (sem client-side movement)
 *
 * =====================================================================
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { setupCamera } from "./camera/camera";
import { setupLight } from "./light/light";

import { createInputBus } from "../input/InputBus";
import { bindInputs } from "../input/inputs";
import { IntentType } from "../input/intents";

import { getSocket } from "@/services/Socket";
import { createPlayerMesh, syncPlayer } from "../entities/character/player";

function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

export function GameCanvas({ snapshot }) {
  const containerRef = useRef(null);

  // ✅ mantém sempre o runtime mais recente sem recriar o Three
  const runtimeRef = useRef(snapshot?.runtime ?? null);

  // ✅ (opcional) mantém também template/geometry mais recente
  const templateRef = useRef(snapshot?.localTemplate ?? null);
  const versionRef = useRef(snapshot?.localTemplateVersion ?? null);

  // Atualiza refs quando snapshot muda (sem remontar)
  useEffect(() => {
    runtimeRef.current = snapshot?.runtime ?? null;
    templateRef.current = snapshot?.localTemplate ?? null;
    versionRef.current = snapshot?.localTemplateVersion ?? null;
  }, [snapshot]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tpl = templateRef.current;
    const sizeX = tpl?.geometry?.size_x ?? 200;
    const sizeZ = tpl?.geometry?.size_z ?? 200;
    const visual = tpl?.visual ?? {};

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

    // ✅ DEBUG: referências visuais (grid + eixos)
    const grid = new THREE.GridHelper(Math.max(sizeX, sizeZ), 20);
    grid.position.y = 0.001;
    scene.add(grid);

    const axes = new THREE.AxesHelper(10);
    axes.position.y = 0.01;
    scene.add(axes);

    // =============================
    // CAMERA + LIGHT
    // =============================
    const { camera, update, applyOrbit, applyZoom, onResize, setBounds, getYaw } =
      setupCamera(container);

    setupLight(scene);
    setBounds({ sizeX, sizeZ });
    window.addEventListener("resize", onResize);

    // =============================
    // INPUT (bus + bind + listener)
    // =============================
    const bus = createInputBus();
    const unbindInputs = bindInputs(renderer.domElement, bus);

    let moveDir = { x: 0, z: 0 };

    const off = bus.on((intent) => {
      if (intent.type === IntentType.CAMERA_ZOOM) {
        applyZoom(intent.delta);
        return;
      }
      if (intent.type === IntentType.CAMERA_ORBIT) {
        applyOrbit(intent.dx, intent.dy);
        return;
      }
      if (intent.type === IntentType.MOVE_DIRECTION) {
        const raw = intent?.dir ?? { x: 0, z: 0 };
        moveDir = normalize2D(raw.x || 0, raw.z || 0);
      }
    });

    // =============================
    // CHÃO
    // =============================
    const color =
      visual?.ground_render_material?.base_color ??
      visual?.ground_color ??
      "#5a5a5a";

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
    });

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeX, sizeZ),
      groundMaterial
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // =============================
    // LIMITES
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
    // PLAYER
    // =============================
    const playerMesh = createPlayerMesh();
    scene.add(playerMesh);

    // sync inicial
    syncPlayer(playerMesh, runtimeRef.current);

    // =============================
    // OVERLAY DEBUG (coords)
    // =============================
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.left = "12px";
    overlay.style.top = "12px";
    overlay.style.padding = "8px 10px";
    overlay.style.background = "rgba(0,0,0,0.55)";
    overlay.style.color = "white";
    overlay.style.fontFamily = "monospace";
    overlay.style.fontSize = "12px";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "10";
    container.style.position = "relative";
    container.appendChild(overlay);

    // =============================
    // LOOP
    // =============================
    let alive = true;
    const clock = new THREE.Clock();

    const tick = () => {
      if (!alive) return;

      const dt = Math.min(clock.getDelta(), 0.05);

      // 1) envia intenção (NÃO move localmente)
      const socket = getSocket();
      if (socket) {
        const camYaw = getYaw();
        const dirWorld = toWorldDir(moveDir, camYaw);

        socket.emit("move:intent", {
          dir: dirWorld,
          dt,
          yawDesired: camYaw 
        });
      }

      // 2) aplica estado confirmado do backend (sempre via ref atualizado)
      const rt = runtimeRef.current;
      syncPlayer(playerMesh, rt);

      // 3) overlay para você VER que está mudando
      if (rt) {
        overlay.textContent =
          `pos: (${Number(rt.pos_x ?? rt.pos?.x ?? 0).toFixed(2)}, ` +
          `${Number(rt.pos_y ?? rt.pos?.y ?? 0).toFixed(2)}, ` +
          `${Number(rt.pos_z ?? rt.pos?.z ?? 0).toFixed(2)})  ` +
          `yaw: ${Number(rt.yaw ?? 0).toFixed(2)}`;
      } else {
        overlay.textContent = "runtime: null";
      }


      function toWorldDir(inputDir, camYaw) {
        // forward da câmera no plano XZ (para onde ela “olha”)
        const fx = -Math.sin(camYaw);
        const fz = -Math.cos(camYaw);

        // right da câmera (90°)
        const rx = fz;
        const rz = -fx;

        // input: W = z:-1 -> queremos forwardAmount = 1
        const forwardAmount = -(inputDir.z || 0);
        const strafeAmount = (inputDir.x || 0);

        const wx = rx * strafeAmount + fx * forwardAmount;
        const wz = rz * strafeAmount + fz * forwardAmount;

        return normalize2D(wx, wz);
      }


      // 4) câmera (visual)
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

      off();
      unbindInputs();
      window.removeEventListener("resize", onResize);

      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);

      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);

      scene.remove(playerMesh);
      playerMesh.geometry.dispose();
      playerMesh.material.dispose();

      scene.remove(grid);
      scene.remove(axes);

      renderer.dispose();

      groundMesh.geometry.dispose();
      groundMesh.material.dispose();

      boundsGeometry.dispose();
      boundsMaterial.dispose();
    };
  }, []); // ✅ monta UMA vez

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
}
