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
import { createPlayerMesh } from "../entities/character/player";

// FIX: cores devem bater com player.jsx (self/other)
const COLOR_SELF = "#ff2d55";
const COLOR_OTHER = "#2d7dff";

function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

function readPosYawFromRuntime(rt) {
  if (!rt) return { x: 0, y: 0, z: 0, yaw: 0 };

  const x = Number(rt.pos_x ?? rt.pos?.x ?? 0);
  const y = Number(rt.pos_y ?? rt.pos?.y ?? 0);
  const z = Number(rt.pos_z ?? rt.pos?.z ?? 0);
  const yaw = Number(rt.yaw ?? 0);

  return { x, y, z, yaw };
}

function readPosYawFromEntity(e) {
  const x = Number(e?.pos?.x ?? 0);
  const y = Number(e?.pos?.y ?? 0);
  const z = Number(e?.pos?.z ?? 0);
  const yaw = Number(e?.yaw ?? 0);
  return { x, y, z, yaw };
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
  const strafeAmount = inputDir.x || 0;

  const wx = rx * strafeAmount + fx * forwardAmount;
  const wz = rz * strafeAmount + fz * forwardAmount;

  return normalize2D(wx, wz);
}

// FIX: recolorir mesh quando selfId mudar (evita "troca de cor" errada)
function applySelfColor(mesh, isSelf) {
  if (!mesh) return;
  const color = isSelf ? COLOR_SELF : COLOR_OTHER;
  mesh.userData.isSelf = !!isSelf;

  const mat = mesh.material;
  if (Array.isArray(mat)) {
    for (const m of mat) {
      if (m?.color) m.color.set(color);
    }
  } else if (mat?.color) {
    mat.color.set(color);
  }
}

export function GameCanvas({ snapshot, worldStoreRef }) {
  const containerRef = useRef(null);

  // ✅ mantém sempre o runtime mais recente sem recriar o Three
  const runtimeRef = useRef(snapshot?.runtime ?? null);

  // ✅ (opcional) mantém também template/geometry mais recente
  const templateRef = useRef(snapshot?.localTemplate ?? null);
  const versionRef = useRef(snapshot?.localTemplateVersion ?? null);

  // ✅ meshes replicados por entidade (multiplayer)
  const meshByEntityIdRef = useRef(new Map());

  // FIX: track de selfId para recolorir meshes existentes
  const lastSelfIdRef = useRef(null);

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
    const sizeX = tpl?.geometry?.size_x;
    const sizeZ = tpl?.geometry?.size_z;
    const visual = tpl?.visual ?? {};

    const centerX = 0;
    const centerZ = 0;

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
    grid.position.set(0, 0.001, 0);
    scene.add(grid);

    const axes = new THREE.AxesHelper(10);
    axes.position.set(0, 0.01, 0);
    scene.add(axes);

    // =============================
    // CAMERA + LIGHT
    // =============================
    const { camera, update, applyOrbit, applyZoom, onResize, setBounds, getYaw } =
      setupCamera(container);

    setupLight(scene);

    // Contrato: mundo 0..size (camera/bounds coerentes com size)
    setBounds({ sizeX, sizeZ });
    window.addEventListener("resize", onResize);

    // =============================
    // CHÃO (mundo 0..size)
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
    groundMesh.position.set(0, 0, 0);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // =============================
    // (CLICK) Raycast infra (reusável)
    // =============================
    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();

    function setMouseFromClientToNdc(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      mouseNdc.x = x * 2 - 1;
      mouseNdc.y = -(y * 2 - 1);
    }

    function emitClickMove(clientX, clientY, moveDir) {
      // (opcional UX) se WASD está ativo localmente, evita enviar click.
      // A regra REAL é server-side, isso aqui só reduz ruído.
      if (!(moveDir.x === 0 && moveDir.z === 0)) return;

      const socket = getSocket();
      if (!socket) return;

      setMouseFromClientToNdc(clientX, clientY);
      raycaster.setFromCamera(mouseNdc, camera);

      const hits = raycaster.intersectObject(groundMesh, false);
      if (!hits || hits.length === 0) return;

      const p = hits[0].point;
      const x = Number(p?.x);
      const z = Number(p?.z);

      if (!Number.isFinite(x) || !Number.isFinite(z)) return;

      socket.emit("move:click", { x, z });
    }

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
        return;
      }

      // (NOVO) LMB click via InputBus -> raycast -> move:click
      if (intent.type === IntentType.CLICK_PRIMARY) {
        emitClickMove(intent.clientX, intent.clientY, moveDir);
        return;
      }
    });

    // =============================
    // LIMITES (mundo 0..size)
    // =============================
    const yLine = 0.2;

    const halfX = sizeX / 2;
    const halfZ = sizeZ / 2;

    const pts = [
      new THREE.Vector3(-halfX, yLine, -halfZ),
      new THREE.Vector3(halfX, yLine, -halfZ),
      new THREE.Vector3(halfX, yLine, halfZ),
      new THREE.Vector3(-halfX, yLine, halfZ),
    ];

    const boundsGeometry = new THREE.BufferGeometry().setFromPoints(pts);
    const boundsMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const bounds = new THREE.LineLoop(boundsGeometry, boundsMaterial);
    bounds.frustumCulled = false;
    scene.add(bounds);

    // =============================
    // OVERLAY DEBUG (coords + entities)
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

    // alvo fixo para fallback de câmera (evita alocar Vector3 por frame)
    const fallbackTarget = new THREE.Object3D();
    fallbackTarget.position.set(0, 0, 0);

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
          yawDesired: camYaw,
        });
      }

      // 2) aplica estado confirmado (multiplayer via store)
      const store = worldStoreRef?.current ?? null;
      const entities = store?.getSnapshot?.() ?? null;
      const selfId = store?.selfId ?? null;

      if (Array.isArray(entities) && entities.length > 0) {
        const selfKey = selfId == null ? null : String(selfId);

        // FIX: se selfId mudou, recolore todos os meshes existentes
        if (lastSelfIdRef.current !== selfKey) {
          for (const [id, mesh] of meshByEntityIdRef.current.entries()) {
            const isSelf = selfKey != null && id === selfKey;
            applySelfColor(mesh, isSelf);
          }
          lastSelfIdRef.current = selfKey;
        }

        // garante/atualiza meshes para todas as entidades do interesse
        const nextIds = new Set();

        for (const e of entities) {
          const entityIdRaw = e?.entityId;
          if (entityIdRaw == null) continue;
          const entityId = String(entityIdRaw);

          nextIds.add(entityId);

          let mesh = meshByEntityIdRef.current.get(entityId);
          if (!mesh) {
            mesh = createPlayerMesh({ isSelf: selfKey != null && entityId === selfKey });
            meshByEntityIdRef.current.set(entityId, mesh);
            scene.add(mesh);
          }
          // FIX: garante cor correta caso selfId mude após o mesh existir
          const isSelfNow = selfKey != null && entityId === selfKey;
          if (mesh.userData?.isSelf !== isSelfNow) {
            applySelfColor(mesh, isSelfNow);
          }

          const { x, y, z, yaw } = readPosYawFromEntity(e);
          mesh.position.set(x, y ?? 0, z);
          mesh.rotation.y = yaw;
        }

        // remove meshes ausentes (despawn/interest swap)
        for (const [entityId, mesh] of meshByEntityIdRef.current.entries()) {
          if (nextIds.has(entityId)) continue;

          scene.remove(mesh);
          try {
            mesh.geometry?.dispose?.();
          } catch {}
          try {
            if (Array.isArray(mesh.material)) {
              for (const m of mesh.material) m?.dispose?.();
            } else {
              mesh.material?.dispose?.();
            }
          } catch {}
          meshByEntityIdRef.current.delete(entityId);
        }

        // Escolhe um "hero" visual para a câmera: self se existir, senão centro
        const heroMesh = selfKey ? meshByEntityIdRef.current.get(selfKey) : null;

        if (heroMesh) update(heroMesh, dt);
        else update(fallbackTarget, dt);

        // overlay
        if (heroMesh) {
          overlay.textContent =
            `entities: ${entities.length}  ` +
            `self: ${selfKey ?? "?"}  ` +
            `pos: (${heroMesh.position.x.toFixed(2)}, ${heroMesh.position.y.toFixed(
              2
            )}, ${heroMesh.position.z.toFixed(2)})  ` +
            `yaw: ${heroMesh.rotation.y.toFixed(2)}`;
        } else {
          overlay.textContent = `entities: ${entities.length}  self: ${selfKey ?? "?"}`;
        }
      } else {
        // 2b) fallback legado: usa runtime do snapshot (single-player placeholder)
        const rt = runtimeRef.current;
        const { x, y, z, yaw } = readPosYawFromRuntime(rt);

        const legacyId = "__legacy_self__";
        let mesh = meshByEntityIdRef.current.get(legacyId);
        if (!mesh) {
          mesh = createPlayerMesh({ isSelf: true });
          meshByEntityIdRef.current.set(legacyId, mesh);
          scene.add(mesh);
        }

        mesh.position.set(x, y ?? 0, z);
        mesh.rotation.y = yaw;

        overlay.textContent =
          `entities: 0 (legacy)  ` +
          `pos: (${x.toFixed(2)}, ${(y ?? 0).toFixed(2)}, ${z.toFixed(
            2
          )})  ` +
          `yaw: ${yaw.toFixed(2)}`;

        update(mesh, dt);
      }

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

      // dispose meshes replicados
      for (const [, mesh] of meshByEntityIdRef.current.entries()) {
        scene.remove(mesh);
        try {
          mesh.geometry?.dispose?.();
        } catch {}
        try {
          if (Array.isArray(mesh.material)) {
            for (const m of mesh.material) m?.dispose?.();
          } else {
            mesh.material?.dispose?.();
          }
        } catch {}
      }
      meshByEntityIdRef.current.clear();

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