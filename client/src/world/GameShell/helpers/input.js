const DEBUG_IDS = false;

export function debugIds(...args) {
  if (!DEBUG_IDS) return;
  // console.log(...args);
}

export function isInteractDown(type) {
  return type === "INTERACT_PRIMARY_DOWN" || type === "INTERACT_PRESS";
}

export function isInteractUp(type) {
  return type === "INTERACT_PRIMARY_UP" || type === "INTERACT_RELEASE";
}
