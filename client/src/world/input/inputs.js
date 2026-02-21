// input/inputs.js

import {
  intentCameraZoom,
  intentCameraOrbit,
  intentMoveDirection,
  // (NOVO)
  intentClickPrimary,
} from "./intents";

export function bindInputs(target, bus) {
  if (!target) throw new Error("bindInputs: target é obrigatório");

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const keys = { w: false, a: false, s: false, d: false };

  const onContextMenu = (e) => e.preventDefault();

  const onMouseDown = (e) => {
    // (NOVO) LMB -> click intent (não interfere no RMB orbit)
    if (e.button === 0) {
      bus.emit(intentClickPrimary(e.clientX, e.clientY));
      return;
    }

    // RMB (orbit)
    if (e.button !== 2) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };

  const onMouseUp = (e) => {
    if (e.button !== 2) return;
    dragging = false;
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    bus.emit(intentCameraOrbit(dx, dy));
  };

  const onWheel = (e) => {
    e.preventDefault();
    bus.emit(intentCameraZoom(Math.sign(e.deltaY)));
  };

  function computeDir() {
    let x = 0;
    let z = 0;

    // forward em Three costuma ser -Z
    if (keys.w) z -= 1;
    if (keys.s) z += 1;
    if (keys.d) x -= 1;
    if (keys.a) x += 1;

    return { x, z };
  }

  function emitMove() {
    const { x, z } = computeDir();
    bus.emit(intentMoveDirection(x, z));
  }

  const onKeyDown = (e) => {
    const k = e.key?.toLowerCase();
    if (!(k in keys)) return;

    // evita spam do auto-repeat
    if (keys[k] === true) return;

    keys[k] = true;
    emitMove();
  };

  const onKeyUp = (e) => {
    const k = e.key?.toLowerCase();
    if (!(k in keys)) return;

    keys[k] = false;
    emitMove();
  };

  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  target.addEventListener("wheel", onWheel, { passive: false });

  // ✅ teclado no window (não depende de foco no canvas)
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ✅ estado inicial (parado)
  bus.emit(intentMoveDirection(0, 0));

  return () => {
    target.removeEventListener("contextmenu", onContextMenu);
    target.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    target.removeEventListener("wheel", onWheel);

    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);

    bus.emit(intentMoveDirection(0, 0));
  };
}