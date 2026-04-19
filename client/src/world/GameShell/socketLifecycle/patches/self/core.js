import { normalizeVitals } from "../../../helpers";

function pickOptional(source, key, fallback) {
  if (source && Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }
  return fallback;
}

export function patchSelfFromBaseline(prev, payload, self) {
  if (!prev || !prev.runtime || !self) return prev;

  const nextVitals = normalizeVitals(self);
  return {
    ...prev,
    runtime: {
      ...prev.runtime,
      yaw: self.yaw ?? prev.runtime.yaw,
      buildLock: pickOptional(payload?.runtime, "buildLock", pickOptional(payload, "buildLock", prev.runtime.buildLock ?? null)),
      sleepLock: pickOptional(payload?.runtime, "sleepLock", pickOptional(payload, "sleepLock", prev.runtime.sleepLock ?? null)),
      cameraPitch:
        payload?.runtime?.cameraPitch ??
        payload?.runtime?.camera_pitch ??
        prev.runtime.cameraPitch ??
        prev.runtime.camera_pitch,
      cameraDistance:
        payload?.runtime?.cameraDistance ??
        payload?.runtime?.camera_distance ??
        prev.runtime.cameraDistance ??
        prev.runtime.camera_distance,
      pos: {
        x: self.pos?.x ?? prev.runtime.pos?.x ?? 0,
        y: self.pos?.y ?? prev.runtime.pos?.y ?? 0,
        z: self.pos?.z ?? prev.runtime.pos?.z ?? 0,
      },
      vitals: nextVitals,
    },
    ui: {
      ...(prev.ui ?? {}),
      self: {
        ...((prev.ui && prev.ui.self) ?? {}),
        ...nextVitals,
        vitals: nextVitals,
      },
    },
  };
}

export function patchSelfFromEntityDelta(prev, self) {
  if (!prev || !prev.runtime || !self) return prev;

  const nextVitals = normalizeVitals(self);
  return {
    ...prev,
    runtime: {
      ...prev.runtime,
      yaw: self.yaw ?? prev.runtime.yaw,
      buildLock: pickOptional(self, "buildLock", prev.runtime.buildLock ?? null),
      sleepLock: pickOptional(self, "sleepLock", prev.runtime.sleepLock ?? null),
      pos: {
        x: self.pos?.x ?? prev.runtime.pos?.x ?? 0,
        y: self.pos?.y ?? prev.runtime.pos?.y ?? 0,
        z: self.pos?.z ?? prev.runtime.pos?.z ?? 0,
      },
      vitals: nextVitals,
    },
    ui: {
      ...(prev.ui ?? {}),
      self: {
        ...((prev.ui && prev.ui.self) ?? {}),
        ...nextVitals,
        vitals: nextVitals,
      },
    },
  };
}

export function patchSelfFromMoveState(prev, payload) {
  if (!prev || !prev.runtime) return prev;

  const x = payload?.pos?.x;
  const y = payload?.pos?.y;
  const z = payload?.pos?.z;

  return {
    ...prev,
    runtime: {
      ...prev.runtime,
      yaw: payload?.yaw ?? prev.runtime.yaw,
      buildLock: pickOptional(payload, "buildLock", prev.runtime.buildLock ?? null),
      sleepLock: pickOptional(payload, "sleepLock", prev.runtime.sleepLock ?? null),
      cameraPitch:
        payload?.cameraPitch ??
        payload?.camera_pitch ??
        prev.runtime.cameraPitch ??
        prev.runtime.camera_pitch,
      cameraDistance:
        payload?.cameraDistance ??
        payload?.camera_distance ??
        prev.runtime.cameraDistance ??
        prev.runtime.camera_distance,
      pos: {
        x: x ?? prev.runtime.pos?.x ?? 0,
        y: y ?? prev.runtime.pos?.y ?? 0,
        z: z ?? prev.runtime.pos?.z ?? 0,
      },
      vitals: payload?.vitals
        ? normalizeVitals({ vitals: payload.vitals })
        : prev.runtime.vitals,
    },
  };
}

export function patchSelfVitalsOnly(prev, nextVitals) {
  if (!prev || !prev.runtime) return prev;

  return {
    ...prev,
    runtime: {
      ...prev.runtime,
      vitals: nextVitals,
    },
    ui: {
      ...(prev.ui ?? {}),
      self: {
        ...((prev.ui && prev.ui.self) ?? {}),
        vitals: nextVitals,
      },
    },
  };
}
