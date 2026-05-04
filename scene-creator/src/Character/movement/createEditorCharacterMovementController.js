function normalizeMovementKey(event) {
  const key = String(event?.key ?? "").toLowerCase();
  const code = String(event?.code ?? "").toLowerCase();

  if (key === "w" || code === "keyw") return "w";
  if (key === "a" || code === "keya") return "a";
  if (key === "s" || code === "keys") return "s";
  if (key === "d" || code === "keyd") return "d";
  if (key === "control" || code === "controlleft" || code === "controlright") return "control";
  return null;
}

function writeInputDebug(state, patch) {
  const current = state?.editorInputStateRef?.current;
  if (!current) return;

  state.editorInputStateRef.current = {
    ...current,
    ...patch,
    activeElementTag: String(document.activeElement?.tagName ?? "none").toLowerCase(),
  };
}

function focusCanvas(canvas) {
  try {
    canvas.focus({ preventScroll: true });
  } catch {
    canvas.focus();
  }
}

function isInsideEditorViewport(state, event) {
  const container = state?.containerRef?.current ?? null;
  if (!container || !event) return false;

  const rect = container.getBoundingClientRect();
  const x = Number(event.clientX ?? NaN);
  const y = Number(event.clientY ?? NaN);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function isInsideScrollableUi(event) {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") return false;
  return !!target.closest('[data-scene-creator-scroll-panel="true"]');
}

export function createEditorCharacterMovementController({ state }) {
  let alive = true;
  let orbiting = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let canvas = null;
  let contextMenuHandler = null;
  let windowContextMenuHandler = null;

  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ctrl: false,
  };

  const syncMoveState = () => {
    const moveState = {
      dir: {
        x: (keys.d ? 1 : 0) + (keys.a ? -1 : 0),
        z: (keys.s ? -1 : 0) + (keys.w ? 1 : 0),
      },
      speedScale: keys.ctrl ? 2 : 1,
    };

    if (state.editorMoveStateRef?.current) {
      state.editorMoveStateRef.current = moveState;
    }

    writeInputDebug(state, {
      moveInput: Number(moveState.dir.z ?? 0),
      strafeInput: Number(moveState.dir.x ?? 0),
      speedScale: moveState.speedScale,
      w: keys.w,
      a: keys.a,
      s: keys.s,
      d: keys.d,
      ctrl: keys.ctrl,
    });

    return moveState;
  };

  const handleKeyDown = (event) => {
    const key = normalizeMovementKey(event);
    if (!key) return;
    if (event.repeat) return;

    if (key === "w") keys.w = true;
    if (key === "a") keys.a = true;
    if (key === "s") keys.s = true;
    if (key === "d") keys.d = true;
    if (key === "control") keys.ctrl = true;

    writeInputDebug(state, {
      keydownCount: Number(state.editorInputStateRef.current?.keydownCount ?? 0) + 1,
      lastEvent: `keydown:${key}`,
      lastKey: key,
      lastCode: String(event.code || "").toLowerCase(),
      lastRepeat: Boolean(event.repeat),
    });

    syncMoveState();
    event.preventDefault();
    event.stopPropagation();
  };

  const handleKeyUp = (event) => {
    const key = normalizeMovementKey(event);
    if (!key) return;

    if (key === "w") keys.w = false;
    if (key === "a") keys.a = false;
    if (key === "s") keys.s = false;
    if (key === "d") keys.d = false;
    if (key === "control") keys.ctrl = false;

    writeInputDebug(state, {
      keyupCount: Number(state.editorInputStateRef.current?.keyupCount ?? 0) + 1,
      lastEvent: `keyup:${key}`,
      lastKey: key,
      lastCode: String(event.code || "").toLowerCase(),
      lastRepeat: Boolean(event.repeat),
    });

    syncMoveState();
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMouseDown = (event) => {
    if (event.button !== 2) return;
    if (!isInsideEditorViewport(state, event)) return;
    orbiting = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    focusCanvas(canvas);
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMouseMove = (event) => {
    if (!orbiting) return;
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    state.cameraApiRef?.current?.applyOrbit?.(dx, dy);
    writeInputDebug(state, {
      orbitCount: Number(state.editorInputStateRef.current?.orbitCount ?? 0) + 1,
      lastEvent: "orbit",
    });
  };

  const handleMouseUp = (event) => {
    if (event.button !== 2) return;
    orbiting = false;
  };

  const handleWheel = (event) => {
    if (!isInsideEditorViewport(state, event)) return;
    if (isInsideScrollableUi(event)) return;
    state.cameraApiRef?.current?.applyZoom?.(event.deltaY);
    writeInputDebug(state, {
      zoomCount: Number(state.editorInputStateRef.current?.zoomCount ?? 0) + 1,
      lastEvent: "zoom",
    });
    event.preventDefault();
    event.stopPropagation();
  };

  const ensureCanvasAndBind = () => {
    if (!alive) return;

    canvas = state.containerRef?.current?.querySelector("canvas") ?? null;
    if (!canvas) {
      requestAnimationFrame(ensureCanvasAndBind);
      return;
    }

    if (typeof canvas.tabIndex === "number" && canvas.tabIndex < 0) {
      canvas.tabIndex = 0;
    }

    contextMenuHandler = (event) => event.preventDefault();
    windowContextMenuHandler = (event) => {
      if (isInsideEditorViewport(state, event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    canvas.addEventListener("contextmenu", contextMenuHandler, true);
    window.addEventListener("pointerdown", handleMouseDown, true);
    window.addEventListener("contextmenu", windowContextMenuHandler, true);
    window.addEventListener("pointermove", handleMouseMove, true);
    window.addEventListener("pointerup", handleMouseUp, true);
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    focusCanvas(canvas);
    writeInputDebug(state, {
      lastEvent: "canvas-bound",
    });
  };

  requestAnimationFrame(ensureCanvasAndBind);

  return () => {
    alive = false;
    if (canvas) {
      if (contextMenuHandler) {
        canvas.removeEventListener("contextmenu", contextMenuHandler, true);
      }
    }
    window.removeEventListener("pointerdown", handleMouseDown, true);
    if (windowContextMenuHandler) {
      window.removeEventListener("contextmenu", windowContextMenuHandler, true);
    }
    window.removeEventListener("pointermove", handleMouseMove, true);
    window.removeEventListener("pointerup", handleMouseUp, true);
    window.removeEventListener("wheel", handleWheel, true);
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("keyup", handleKeyUp, true);
  };
}
