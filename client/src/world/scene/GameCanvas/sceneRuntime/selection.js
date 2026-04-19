import * as THREE from "three";
import { getSocket } from "@/services/Socket";
import { IntentType } from "../../../input/intents";
import { pickTargetFromHitObject } from "../helpers";

export function createSelectionTools({
  renderer,
  camera,
  groundMesh,
  worldStoreRef,
  state,
  onInputIntent,
  onTargetSelect,
  onTargetClear,
}) {
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

    const candidates = [
      ...state.meshByActorIdRef.current.values(),
      ...state.meshByEnemyIdRef.current.values(),
      ...state.meshByEntityIdRef.current.values(),
    ];
    if (candidates.length === 0) return null;

    const hits = raycaster.intersectObjects(candidates, true);
    if (!hits?.length) return null;

    const hitObject = hits[0].object;
    const target = pickTargetFromHitObject(hitObject);
    if (!target) return null;

    if (target.kind === "PLAYER") {
      const store = worldStoreRef?.current ?? null;
      const selfId = store?.selfId ?? null;
      if (selfId != null && String(target.id) === String(selfId)) return null;
    }

    return { target, hitObject };
  }

  function tryPickGround(clientX, clientY) {
    setMouseFromClientToNdc(clientX, clientY);
    raycaster.setFromCamera(mouseNdc, camera);
    const hits = raycaster.intersectObject(groundMesh, false);
    if (!hits?.length) return null;

    const point = hits[0].point;
    const x = Number(point?.x);
    const z = Number(point?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;

    return { x, z };
  }

  function clearSelection() {
    state.selectedTargetRef.current = null;
    state.selectedObjectRef.current = null;
    state.setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    state.setTargetHpBar(null);
    state.setTargetPlayerCard(null);
    state.setTargetLootCard(null);
    onTargetClear?.();
    onInputIntent?.({ type: IntentType.TARGET_CLEAR });
  }

  function setSelection(target, obj) {
    state.selectedTargetRef.current = target;

    let root = obj;
    while (root?.parent && root.parent.type !== "Scene") {
      root = root.parent;
    }
    state.selectedObjectRef.current = root ?? obj;

    const payload = { kind: target.kind, id: String(target.id) };
    onTargetSelect?.(payload);
    onInputIntent?.({ type: IntentType.TARGET_SELECT, target: payload });
  }

  function emitClick(clientX, clientY, moveDir) {
    const socket = getSocket();
    if (!socket) return;

    const buildPlacement = state.buildPlacementRef?.current ?? null;
    if (buildPlacement?.visible) {
      const ground = tryPickGround(clientX, clientY);
      if (!ground) return;
      onInputIntent?.({
        type: IntentType.BUILD_PLACE_CONFIRM,
        worldPos: ground,
      });
      return;
    }

    const picked = tryPickTarget(clientX, clientY);
    if (picked?.target) {
      setSelection(picked.target, picked.hitObject);
      return;
    }

    clearSelection();
    if (!(moveDir.x === 0 && moveDir.z === 0)) return;

    setMouseFromClientToNdc(clientX, clientY);
    raycaster.setFromCamera(mouseNdc, camera);
    const hits = raycaster.intersectObject(groundMesh, false);
    if (!hits?.length) return;

    const point = hits[0].point;
    const x = Number(point?.x);
    const z = Number(point?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;

    socket.emit("move:click", { x, z });
  }

  function emitContextMenu(clientX, clientY) {
    const picked = tryPickTarget(clientX, clientY);
    if (picked?.target) {
      setSelection(picked.target, picked.hitObject);
      return picked.target;
    }

    return null;
  }

  return {
    emitClick,
    emitContextMenu,
    tryPickGround,
    clearSelection,
  };
}
