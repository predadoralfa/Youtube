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
 * - Renderizar ACTORS (chests, trees, NPCs) usando ActorFactory
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
 * - Renderiza ACTORS (chests, trees, NPCs) do snapshot.actors[]
 * - Cria um Player placeholder (cilindro) e mantém ele na cena
 * - Sincroniza Player (posição/rotação) usando runtime confirmado
 * - Lê intents do InputBus:
 *   - CAMERA_ZOOM / CAMERA_ORBIT: afetam apenas a câmera local
 *   - MOVE_DIRECTION: envia "move:intent" para o backend com { dir, dt }
 *   - CLICK_PRIMARY: raycast -> select target / move:click (se WASD não ativo)
 *   - INTERACT_PRESS / INTERACT_RELEASE: envia interact:start/stop com target selecionado
 *
 * 🤖 IAs:
 * - NÃO remover este comentário
 * - NÃO mover lógica para fora deste arquivo
 * - NÃO introduzir simulação local do mundo (sem client-side movement)
 *
 * =====================================================================
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { setupCamera } from "./camera/camera";
import { setupLight } from "./light/light";

import { createInputBus } from "../input/InputBus";
import { bindInputs } from "../input/inputs";
import { IntentType } from "../input/intents";

import { getSocket } from "@/services/Socket";
import { createPlayerMesh } from "../entities/character/player";
import { createActorMesh } from "../entities/actors/ActorFactory";
import { TargetMarker } from "./TargetMarker";

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
  const fx = -Math.sin(camYaw);
  const fz = -Math.cos(camYaw);

  const rx = fz;
  const rz = -fx;

  const forwardAmount = -(inputDir.z || 0);
  const strafeAmount = inputDir.x || 0;

  const wx = rx * strafeAmount + fx * forwardAmount;
  const wz = rz * strafeAmount + fz * forwardAmount;

  return normalize2D(wx, wz);
}

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

function pickTargetFromHitObject(obj) {
  let cur = obj;
  while (cur) {
    const ud = cur.userData || {};

    if (ud.actorId != null) {
      return {
        kind: "ACTOR",
        id: String(ud.actorId),
        actorType: ud.actorType ? String(ud.actorType) : null,
      };
    }

    if (ud.playerId != null) return { kind: "PLAYER", id: String(ud.playerId) };
    if (ud.entityId != null) return { kind: "PLAYER", id: String(ud.entityId) };

    cur = cur.parent;
  }
  return null;
}

function projectWorldToScreenPx(worldPos, camera, domElement) {
  const rect = domElement.getBoundingClientRect();
  const v = worldPos.clone().project(camera);

  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || v.z < -1 || v.z > 1) return null;

  const x = (v.x * 0.5 + 0.5) * rect.width;
  const y = (-v.y * 0.5 + 0.5) * rect.height;

  return { x, y };
}

export function GameCanvas({
  snapshot,
  worldStoreRef,
  onInputIntent,
  onTargetSelect,
  onTargetClear,
}) {
  const containerRef = useRef(null);

  const runtimeRef = useRef(snapshot?.runtime ?? null);
  const templateRef = useRef(snapshot?.localTemplate ?? null);
  const versionRef = useRef(snapshot?.localTemplateVersion ?? null);
  const actorsRef = useRef(snapshot?.actors ?? []);

  const meshByEntityIdRef = useRef(new Map());
  const meshByActorIdRef = useRef(new Map());

  const lastSelfIdRef = useRef(null);

  const selectedTargetRef = useRef(null); // { kind, id, actorType? }
  const selectedObjectRef = useRef(null); // THREE.Object3D

  const [marker, setMarker] = useState({ visible: false, x: 0, y: 0 });

  useEffect(() => {
    runtimeRef.current = snapshot?.runtime ?? null;
    templateRef.current = snapshot?.localTemplate ?? null;
    versionRef.current = snapshot?.localTemplateVersion ?? null;
    actorsRef.current = snapshot?.actors ?? [];
  }, [snapshot]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tpl = templateRef.current;
    const sizeX = tpl?.geometry?.size_x;
    const sizeZ = tpl?.geometry?.size_z;
    const visual = tpl?.visual ?? {};

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const grid = new THREE.GridHelper(Math.max(sizeX, sizeZ), 20);
    grid.position.set(0, 0.001, 0);
    scene.add(grid);

    const axes = new THREE.AxesHelper(10);
    axes.position.set(0, 0.01, 0);
    scene.add(axes);

    const { camera, update, applyOrbit, applyZoom, onResize, setBounds, getYaw } =
      setupCamera(container);

    setupLight(scene);

    setBounds({ sizeX, sizeZ });
    window.addEventListener("resize", onResize);

    const color =
      visual?.ground_render_material?.base_color ?? visual?.ground_color ?? "#5a5a5a";

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
    });

    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ), groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, 0, 0);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();

    function setMouseFromClientToNdc(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      mouseNdc.x = x * 2 - 1;
      mouseNdc.y = -(y * 2 - 1);
    }

    function tryPickTarget(clientX, clientY) {
      setMouseFromClientToNdc(clientX, clientY);
      raycaster.setFromCamera(mouseNdc, camera);

      const actorMeshes = Array.from(meshByActorIdRef.current.values());
      const entityMeshes = Array.from(meshByEntityIdRef.current.values());

      const candidates = [];
      for (const m of actorMeshes) candidates.push(m);
      for (const m of entityMeshes) candidates.push(m);

      if (candidates.length === 0) return null;

      const hits = raycaster.intersectObjects(candidates, true);
      if (!hits || hits.length === 0) return null;

      const hitObj = hits[0].object;
      const t = pickTargetFromHitObject(hitObj);
      if (!t) return null;

      // não selecionar self
      if (t.kind === "PLAYER") {
        const store = worldStoreRef?.current ?? null;
        const selfId = store?.selfId ?? null;
        if (selfId != null && String(t.id) === String(selfId)) return null;
      }

      return { target: t, hitObject: hitObj };
    }

    function clearSelection() {
      selectedTargetRef.current = null;
      selectedObjectRef.current = null;
      setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      onTargetClear?.();
    }

    function setSelection(t, obj) {
      selectedTargetRef.current = t;

      let root = obj;
      while (root?.parent && root.parent.type !== "Scene") root = root.parent;
      selectedObjectRef.current = root ?? obj;

      onTargetSelect?.({ kind: t.kind, id: String(t.id) });
    }

    // ✅ MUDANÇA AQUI: selecionar sempre, mesmo com WASD; mover no chão só se WASD não ativo
    function emitClick(clientX, clientY, moveDir) {
      const socket = getSocket();
      if (!socket) return;

      // 1) SEMPRE tenta selecionar alvo (independente do WASD)
      const picked = tryPickTarget(clientX, clientY);
      if (picked?.target) {
        setSelection(picked.target, picked.hitObject);
        return;
      }

      // 2) Se não acertou alvo, limpar seleção
      clearSelection();

      // 3) Se WASD está ativo, NÃO envia move:click no chão (evita briga de controle)
      if (!(moveDir.x === 0 && moveDir.z === 0)) return;

      // 4) Caso contrário, raycast no chão e envia move:click
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

    function emitInteractStart() {
      const socket = getSocket();
      if (!socket) return;

      const t = selectedTargetRef.current;
      if (!t?.kind || t?.id == null) return;

      socket.emit("interact:start", {
        target: { kind: t.kind, id: String(t.id) },
        stopRadius: 1.25,
      });
    }

    function emitInteractStop() {
      const socket = getSocket();
      if (!socket) return;
      socket.emit("interact:stop", {});
    }

    const bus = createInputBus();
    const unbindInputs = bindInputs(renderer.domElement, bus);

    let moveDir = { x: 0, z: 0 };

    const off = bus.on((intent) => {
      if (intent?.type === IntentType.UI_TOGGLE_INVENTORY) {
        onInputIntent?.(intent);
        return;
      }

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

      if (intent.type === IntentType.CLICK_PRIMARY) {
        emitClick(intent.clientX, intent.clientY, moveDir);
        return;
      }

      if (intent.type === IntentType.INTERACT_PRESS) {
        emitInteractStart();
        return;
      }
      if (intent.type === IntentType.INTERACT_RELEASE) {
        emitInteractStop();
        return;
      }

      onInputIntent?.(intent);
    });

    // bounds wireframe
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

    // loop
    let alive = true;
    const clock = new THREE.Clock();

    const fallbackTarget = new THREE.Object3D();
    fallbackTarget.position.set(0, 0, 0);

    let markerAccum = 0;
    const tmpWorld = new THREE.Vector3();

    const tick = () => {
      if (!alive) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      markerAccum += dt;

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

      // ACTORS
      const actors = actorsRef.current ?? [];
      const nextActorIds = new Set();

      for (const actor of actors) {
        const actorId = String(actor.id);
        nextActorIds.add(actorId);

        let mesh = meshByActorIdRef.current.get(actorId);
        if (!mesh) {
          mesh = createActorMesh(actor);

          mesh.userData.kind = mesh.userData.kind ?? "ACTOR";
          mesh.userData.actorId = mesh.userData.actorId ?? actorId;
          mesh.userData.actorType =
            mesh.userData.actorType ?? actor.actorType ?? actor.actor_type ?? null;

          meshByActorIdRef.current.set(actorId, mesh);
          scene.add(mesh);
        }

        const { x, y, z, yaw } = readPosYawFromEntity(actor);
        mesh.position.set(x, y ?? 0, z);
        mesh.rotation.y = yaw ?? 0;
      }

      for (const [actorId, mesh] of meshByActorIdRef.current.entries()) {
        if (nextActorIds.has(actorId)) continue;

        const sel = selectedTargetRef.current;
        if (sel?.kind === "ACTOR" && String(sel.id) === String(actorId)) {
          clearSelection();
        }

        scene.remove(mesh);
        try {
          mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
              else child.material.dispose();
            }
          });
        } catch {}
        meshByActorIdRef.current.delete(actorId);
      }

      // entities store
      const store = worldStoreRef?.current ?? null;
      const entities = store?.getSnapshot?.() ?? null;
      const selfId = store?.selfId ?? null;

      if (Array.isArray(entities) && entities.length > 0) {
        const selfKey = selfId == null ? null : String(selfId);

        if (lastSelfIdRef.current !== selfKey) {
          for (const [id, mesh] of meshByEntityIdRef.current.entries()) {
            const isSelf = selfKey != null && id === selfKey;
            applySelfColor(mesh, isSelf);
          }
          lastSelfIdRef.current = selfKey;
        }

        const nextIds = new Set();

        for (const e of entities) {
          const entityIdRaw = e?.entityId;
          if (entityIdRaw == null) continue;
          const entityId = String(entityIdRaw);

          nextIds.add(entityId);

          let mesh = meshByEntityIdRef.current.get(entityId);
          if (!mesh) {
            mesh = createPlayerMesh({ isSelf: selfKey != null && entityId === selfKey });

            mesh.userData.kind = "PLAYER";
            mesh.userData.entityId = entityId;

            meshByEntityIdRef.current.set(entityId, mesh);
            scene.add(mesh);
          }

          const isSelfNow = selfKey != null && entityId === selfKey;
          if (mesh.userData?.isSelf !== isSelfNow) {
            applySelfColor(mesh, isSelfNow);
          }

          const { x, y, z, yaw } = readPosYawFromEntity(e);
          mesh.position.set(x, y ?? 0, z);
          mesh.rotation.y = yaw;
        }

        for (const [entityId, mesh] of meshByEntityIdRef.current.entries()) {
          if (nextIds.has(entityId)) continue;

          const sel = selectedTargetRef.current;
          if (sel?.kind === "PLAYER" && String(sel.id) === String(entityId)) {
            clearSelection();
          }

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

        const heroMesh = selfKey ? meshByEntityIdRef.current.get(selfKey) : null;
        if (heroMesh) update(heroMesh, dt);
        else update(fallbackTarget, dt);
      } else {
        const rt = runtimeRef.current;
        const { x, y, z, yaw } = readPosYawFromRuntime(rt);

        const legacyId = "__legacy_self__";
        let mesh = meshByEntityIdRef.current.get(legacyId);
        if (!mesh) {
          mesh = createPlayerMesh({ isSelf: true });

          mesh.userData.kind = "PLAYER";
          mesh.userData.entityId = legacyId;

          meshByEntityIdRef.current.set(legacyId, mesh);
          scene.add(mesh);
        }

        mesh.position.set(x, y ?? 0, z);
        mesh.rotation.y = yaw;

        update(mesh, dt);
      }

      // marker update (throttle)
      if (markerAccum >= 0.05) {
        markerAccum = 0;

        const obj = selectedObjectRef.current;
        if (!obj) {
          setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        } else {
          obj.getWorldPosition(tmpWorld);
          tmpWorld.y += 0.9;

          const screen = projectWorldToScreenPx(tmpWorld, camera, renderer.domElement);
          if (!screen) {
            setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          } else {
            setMarker({ visible: true, x: screen.x, y: screen.y });
          }
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    return () => {
      alive = false;

      off();
      unbindInputs();
      window.removeEventListener("resize", onResize);

      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);

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

      for (const [, mesh] of meshByActorIdRef.current.entries()) {
        scene.remove(mesh);
        try {
          mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
              else child.material.dispose();
            }
          });
        } catch {}
      }
      meshByActorIdRef.current.clear();

      scene.remove(grid);
      scene.remove(axes);

      renderer.dispose();

      groundMesh.geometry.dispose();
      groundMesh.material.dispose();

      boundsGeometry.dispose();
      boundsMaterial.dispose();

      selectedTargetRef.current = null;
      selectedObjectRef.current = null;
      setMarker({ visible: false, x: 0, y: 0 });
    };
  }, []); // monta uma vez

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <TargetMarker visible={marker.visible} x={marker.x} y={marker.y} />
    </div>
  );
}