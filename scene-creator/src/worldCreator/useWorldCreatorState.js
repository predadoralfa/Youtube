import { useMemo, useRef, useState } from "react";
import { createEntitiesStore } from "@/world/state/entitiesStore";
import { isEditorCharacter } from "../Character/editorCharacter";

export function useWorldCreatorState() {
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [catalogs, setCatalogs] = useState({ actorDefs: [], objectDefs: [] });
  const [editorMeta, setEditorMeta] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const worldStoreRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const editorCameraFocusRef = useRef({ x: 0, y: 0, z: 0 });
  const editorMoveSpeedRef = useRef(10);
  const editorCharacterVisibleRef = useRef(true);
  const editorAnchorRef = useRef({ x: 0, y: 0, z: 0 });
  const editorCharacterRef = useRef(null);
  const editorMoveStateRef = useRef({ dir: { x: 0, z: 0 }, speedScale: 1 });
  const runtimeRef = useRef(null);
  const cameraRef = useRef(null);
  const cameraApiRef = useRef(null);
  const editorInputStateRef = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    ctrl: false,
    moveInput: 0,
    strafeInput: 0,
    cameraYaw: 0,
    characterYaw: 0,
    focusX: 0,
    focusZ: 0,
    keydownCount: 0,
    keyupCount: 0,
    orbitCount: 0,
    zoomCount: 0,
    lastEvent: "idle",
    activeElementTag: "none",
    lastKey: "none",
    lastCode: "none",
    lastRepeat: false,
  });

  if (!worldStoreRef.current) {
    worldStoreRef.current = createEntitiesStore();
  }

  const counts = useMemo(
    () => ({
      actors: Array.isArray(snapshot?.actors) ? snapshot.actors.length : 0,
      sceneObjects: Array.isArray(snapshot?.sceneObjects)
        ? snapshot.sceneObjects.filter((entry) => !isEditorCharacter(entry)).length
        : 0,
      actorDefs: Array.isArray(catalogs?.actorDefs) ? catalogs.actorDefs.length : 0,
      objectDefs: Array.isArray(catalogs?.objectDefs) ? catalogs.objectDefs.length : 0,
    }),
    [catalogs, snapshot]
  );

  if (!stateRef.current) {
    stateRef.current = {
      loading,
      setLoading,
      bootstrapError,
      setBootstrapError,
      snapshot,
      setSnapshot,
      catalogs,
      setCatalogs,
      editorMeta,
      setEditorMeta,
      selectedTarget,
      setSelectedTarget,
      flashMessage,
      setFlashMessage,
      editorCameraFocusRef,
      editorMoveSpeedRef,
      editorCharacterVisibleRef,
      editorAnchorRef,
      editorCharacterRef,
      editorMoveStateRef,
      runtimeRef,
      cameraRef,
      cameraApiRef,
      editorInputStateRef,
      counts,
      worldStoreRef,
      containerRef,
    };
  }

  stateRef.current.loading = loading;
  stateRef.current.bootstrapError = bootstrapError;
  stateRef.current.snapshot = snapshot;
  stateRef.current.catalogs = catalogs;
  stateRef.current.editorMeta = editorMeta;
  stateRef.current.selectedTarget = selectedTarget;
  stateRef.current.flashMessage = flashMessage;
  stateRef.current.editorCameraFocusRef = editorCameraFocusRef;
  stateRef.current.editorMoveSpeedRef = editorMoveSpeedRef;
  stateRef.current.editorCharacterVisibleRef = editorCharacterVisibleRef;
  stateRef.current.editorAnchorRef = editorAnchorRef;
  stateRef.current.editorCharacterRef = editorCharacterRef;
  stateRef.current.editorMoveStateRef = editorMoveStateRef;
  stateRef.current.runtimeRef = runtimeRef;
  stateRef.current.cameraRef = cameraRef;
  stateRef.current.cameraApiRef = cameraApiRef;
  stateRef.current.editorInputStateRef = editorInputStateRef;
  stateRef.current.counts = counts;
  stateRef.current.containerRef = containerRef;

  return stateRef.current;
}
