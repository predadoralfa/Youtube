// cliente/src/world/input/inputs.js

import {
  intentCameraOrbit,
  intentCameraZoom,
  intentMoveDirection,
  intentClickPrimary,
  intentUiToggleInventory,
  intentUiCancel,
  intentInteractPress,
  intentInteractRelease,
} from "./intents";

/**
 * bindInputs(domElement, bus)
 *
 * Responsável apenas por traduzir eventos do browser -> intents no bus.
 * Não faz gameplay, não toca socket, não decide UI.
 */
export function bindInputs(domElement, bus) {
  if (!domElement) throw new Error("bindInputs: domElement required");
  if (!bus) throw new Error("bindInputs: bus required");

  // =========================
  // Estado de teclado (WASD)
  // =========================
  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
  };

  function emitMove() {
    const x = (keys.d ? -1 : 0) + (keys.a ? 1 : 0);
    const z = (keys.s ? 1 : 0) + (keys.w ? -1 : 0);
    bus.emit(intentMoveDirection(x, z));
  }

  function isTypingTarget(target) {
    if (!target || typeof target !== "object") return false;

    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (target.isContentEditable) return true;

    return false;
  }

  // =========================
  // Mouse (click + wheel + orbit)
  // =========================
  let orbiting = false;
  let lastX = 0;
  let lastY = 0;

  function onMouseDown(e) {
    // RMB = orbit
    if (e.button === 2) {
      orbiting = true;
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
      return;
    }

    // LMB = click primary
    if (e.button === 0) {
      bus.emit(intentClickPrimary(e.clientX, e.clientY));
      e.preventDefault();
    }
  }

  function onMouseMove(e) {
    if (!orbiting) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    lastX = e.clientX;
    lastY = e.clientY;

    bus.emit(intentCameraOrbit(dx, dy));
    e.preventDefault();
  }

  function onMouseUp(e) {
    if (e.button === 2) {
      orbiting = false;
      e.preventDefault();
    }
  }

  function onWheel(e) {
    const delta = e.deltaY;
    bus.emit(intentCameraZoom(delta));
    e.preventDefault();
  }

  // =========================
  // Teclado
  // =========================
  function onKeyDown(e) {
    if (isTypingTarget(e.target)) return;

    // evita repetir spam (segurar tecla)
    if (e.repeat) return;

    const k = e.key?.toLowerCase?.();

    // WASD
    if (k === "w") {
      keys.w = true;
      emitMove();
      e.preventDefault();
      return;
    }

    if (k === "a") {
      keys.a = true;
      emitMove();
      e.preventDefault();
      return;
    }

    if (k === "s") {
      keys.s = true;
      emitMove();
      e.preventDefault();
      return;
    }

    if (k === "d") {
      keys.d = true;
      emitMove();
      e.preventDefault();
      return;
    }

    // I = inventário
    if (k === "i") {
      bus.emit(intentUiToggleInventory());
      e.preventDefault();
      return;
    }

    // ESC = cancelar/fechar janelas
    if (k === "escape") {
      bus.emit(intentUiCancel());
      e.preventDefault();
      return;
    }

    // SPACE = interact press
    if (e.code === "Space" || k === " ") {
      bus.emit(intentInteractPress());
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    if (isTypingTarget(e.target)) return;

    const k = e.key?.toLowerCase?.();

    // WASD
    if (k === "w") {
      keys.w = false;
      emitMove();
      e.preventDefault();
      return;
    }

    if (k === "a") {
      keys.a = false;
      emitMove();
      e.preventDefault();
      return;
    }

    if (k === "s") {
      keys.s = false;
      emitMove();
      e.preventDefault();
      return;
    }

    if (k === "d") {
      keys.d = false;
      emitMove();
      e.preventDefault();
      return;
    }

    // SPACE = interact release
    if (e.code === "Space" || k === " ") {
      bus.emit(intentInteractRelease());
      e.preventDefault();
    }
  }

  // =========================
  // Bind
  // =========================
  function onContextMenu(e) {
    e.preventDefault();
  }

  domElement.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  domElement.addEventListener("wheel", onWheel, { passive: false });
  domElement.addEventListener("contextmenu", onContextMenu);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // unbind
  return function unbindInputs() {
    domElement.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    domElement.removeEventListener("wheel", onWheel);
    domElement.removeEventListener("contextmenu", onContextMenu);

    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
