import { intentCameraZoom, intentCameraOrbit } from "./intents";

export function bindInputs(target, bus) {
  if (!target) throw new Error("bindInputs: target é obrigatório");

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onContextMenu = (e) => e.preventDefault();

  const onMouseDown = (e) => {
    if (e.button !== 2) return; // RMB
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

  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  target.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    target.removeEventListener("contextmenu", onContextMenu);
    target.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    target.removeEventListener("wheel", onWheel);
  };
}
