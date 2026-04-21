"use strict";

const { normalize2D } = require("../math");

function cloneDir(dir) {
  return {
    x: Number(dir?.x ?? 0),
    z: Number(dir?.z ?? 0),
  };
}

function cloneTarget(target) {
  if (!target) return null;
  const x = Number(target.x ?? NaN);
  const z = Number(target.z ?? NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z };
}

function hasDir(dir) {
  return Number(dir?.x ?? 0) !== 0 || Number(dir?.z ?? 0) !== 0;
}

function normalizeDir(dir) {
  return normalize2D(Number(dir?.x ?? 0), Number(dir?.z ?? 0));
}

function ensureMovementInputState(runtime) {
  if (!runtime || typeof runtime !== "object") {
    throw new Error("ensureMovementInputState: runtime required");
  }

  let input = runtime.movementInput;
  if (!input || typeof input !== "object") {
    input = {
      mode: "STOP",
      dir: { x: 0, z: 0 },
      target: null,
      stopRadius: 0.75,
      seq: 0,
      updatedAtMs: 0,
      yaw: Number(runtime.yaw ?? 0),
      cameraPitch: Number(runtime.cameraPitch ?? Math.PI / 4),
      cameraDistance: Number(runtime.cameraDistance ?? 26),
    };
    runtime.movementInput = input;
  }

  input.mode = String(input.mode ?? "STOP");
  input.dir = normalizeDir(input.dir);
  input.target = cloneTarget(input.target);
  input.stopRadius = Number.isFinite(Number(input.stopRadius)) && Number(input.stopRadius) > 0
    ? Number(input.stopRadius)
    : 0.75;
  input.seq = Number.isFinite(Number(input.seq)) ? Number(input.seq) : 0;
  input.updatedAtMs = Number.isFinite(Number(input.updatedAtMs)) ? Number(input.updatedAtMs) : 0;
  input.yaw = Number.isFinite(Number(input.yaw)) ? Number(input.yaw) : Number(runtime.yaw ?? 0);
  input.cameraPitch = Number.isFinite(Number(input.cameraPitch))
    ? Number(input.cameraPitch)
    : Number(runtime.cameraPitch ?? Math.PI / 4);
  input.cameraDistance = Number.isFinite(Number(input.cameraDistance))
    ? Number(input.cameraDistance)
    : Number(runtime.cameraDistance ?? 26);
  return input;
}

function syncLookState(runtime, payload = {}) {
  const input = ensureMovementInputState(runtime);
  let yawChanged = false;
  let cameraChanged = false;

  if (Number.isFinite(Number(payload.yaw))) {
    const nextYaw = Number(payload.yaw);
    if (Number(runtime.yaw ?? 0) !== nextYaw) {
      runtime.yaw = nextYaw;
      yawChanged = true;
    }
    input.yaw = nextYaw;
  }

  if (Number.isFinite(Number(payload.cameraPitch))) {
    const nextPitch = Number(payload.cameraPitch);
    if (Number(runtime.cameraPitch ?? 0) !== nextPitch) {
      runtime.cameraPitch = nextPitch;
      cameraChanged = true;
    }
    input.cameraPitch = nextPitch;
  }

  if (Number.isFinite(Number(payload.cameraDistance))) {
    const nextDistance = Number(payload.cameraDistance);
    if (Number(runtime.cameraDistance ?? 0) !== nextDistance) {
      runtime.cameraDistance = nextDistance;
      cameraChanged = true;
    }
    input.cameraDistance = nextDistance;
  }

  return {
    input,
    yawChanged,
    cameraChanged,
    lookChanged: yawChanged || cameraChanged,
  };
}

function applyWASDInput(runtime, payload = {}) {
  const nowMs = Number(payload.nowMs ?? Date.now());
  const input = ensureMovementInputState(runtime);
  const prevMode = input.mode;
  const prevDir = cloneDir(input.dir);
  const look = syncLookState(runtime, payload);
  const nextDir = normalizeDir(payload.dir);
  const nextMode = hasDir(nextDir) ? "WASD" : "STOP";

  input.mode = nextMode;
  input.dir = nextDir;
  input.target = null;
  input.updatedAtMs = nowMs;
  if (Number.isFinite(Number(payload.seq))) {
    input.seq = Number(payload.seq);
  }

  const dirChanged = prevDir.x !== nextDir.x || prevDir.z !== nextDir.z;
  const modeChanged = prevMode !== nextMode;

  return {
    input,
    changed: dirChanged || modeChanged || look.lookChanged,
    dirChanged,
    modeChanged,
    startedMoving: nextMode === "WASD" && prevMode !== "WASD",
    stoppedMoving: prevMode === "WASD" && nextMode === "STOP",
    moving: nextMode === "WASD",
    yawChanged: look.yawChanged,
    cameraChanged: look.cameraChanged,
    lookChanged: look.lookChanged,
  };
}

function applyClickInput(runtime, payload = {}) {
  const nowMs = Number(payload.nowMs ?? Date.now());
  const input = ensureMovementInputState(runtime);
  const prevMode = input.mode;
  const prevTarget = cloneTarget(input.target);
  const target = cloneTarget(payload.target);

  input.mode = target ? "CLICK" : "STOP";
  input.dir = { x: 0, z: 0 };
  input.target = target;
  input.stopRadius = Number(payload.stopRadius ?? input.stopRadius ?? 0.75);
  input.updatedAtMs = nowMs;
  if (Number.isFinite(Number(payload.seq))) {
    input.seq = Number(payload.seq);
  }

  return {
    input,
    changed:
      prevMode !== input.mode ||
      Number(prevTarget?.x ?? NaN) !== Number(target?.x ?? NaN) ||
      Number(prevTarget?.z ?? NaN) !== Number(target?.z ?? NaN),
  };
}

function stopMovement(runtime, payload = {}) {
  const nowMs = Number(payload.nowMs ?? Date.now());
  const input = ensureMovementInputState(runtime);
  const prevMode = input.mode;
  const prevDir = cloneDir(input.dir);
  const prevTarget = cloneTarget(input.target);

  input.mode = "STOP";
  input.dir = { x: 0, z: 0 };
  input.target = null;
  input.updatedAtMs = nowMs;

  return {
    input,
    changed:
      prevMode !== "STOP" ||
      hasDir(prevDir) ||
      prevTarget != null,
  };
}

function isWASDIntentActive(runtime) {
  const input = ensureMovementInputState(runtime);
  return input.mode === "WASD" && hasDir(input.dir);
}

module.exports = {
  ensureMovementInputState,
  syncLookState,
  applyWASDInput,
  applyClickInput,
  stopMovement,
  isWASDIntentActive,
};
