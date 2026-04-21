import { normalizeVitals } from "../../../helpers";

function pickOptional(source, key, fallback) {
  if (source && Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }
  return fallback;
}

function mergeStatusLike(base, overlay) {
  if (!base && !overlay) return base ?? overlay ?? null;

  return {
    ...(base ?? {}),
    ...(overlay ?? {}),
    immunity: {
      ...((base && base.immunity) ?? {}),
      ...((overlay && overlay.immunity) ?? {}),
    },
    fever: {
      ...((base && base.fever) ?? {}),
      ...((overlay && overlay.fever) ?? {}),
    },
    debuffs: {
      ...((base && base.debuffs) ?? {}),
      ...((overlay && overlay.debuffs) ?? {}),
    },
    sleep: {
      ...((base && base.sleep) ?? {}),
      ...((overlay && overlay.sleep) ?? {}),
    },
  };
}

export function patchSelfFromBaseline(prev, payload, self) {
  if (!prev || !prev.runtime || !self) return prev;

  const nextVitals = normalizeVitals(self);
  const payloadRev = Number(payload?.runtime?.rev ?? payload?.rev ?? self?.rev ?? prev.runtime.rev ?? 0);
  const nextStatus = mergeStatusLike(
    prev.runtime.status,
    mergeStatusLike(payload?.runtime?.status ?? null, self?.status ?? null)
  );
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
      speed:
        payload?.runtime?.speed ??
        payload?.speed ??
        self?.speed ??
        null,
      rev: Number.isFinite(payloadRev) ? payloadRev : prev.runtime.rev ?? 0,
      status: nextStatus,
      vitals: nextVitals,
    },
    ui: {
      ...(prev.ui ?? {}),
      self: {
        ...((prev.ui && prev.ui.self) ?? {}),
        ...nextVitals,
        status: nextStatus,
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
      rev: self.rev ?? prev.runtime.rev ?? 0,
      speed: prev.runtime.speed ?? null,
      effectiveMoveSpeed: prev.runtime.effectiveMoveSpeed ?? null,
      action: self.action ?? prev.runtime.action ?? "idle",
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

  const nextRev = Number(payload?.rev ?? NaN);
  const prevRev = Number(prev.runtime.rev ?? -1);
  if (Number.isFinite(nextRev) && nextRev <= prevRev) {
    return prev;
  }

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
      rev: Number.isFinite(nextRev) ? nextRev : prev.runtime.rev ?? 0,
      speed: payload?.speed ?? prev.runtime.speed ?? null,
      effectiveMoveSpeed: payload?.effectiveMoveSpeed ?? prev.runtime.effectiveMoveSpeed ?? null,
      movement: payload?.movement ?? prev.runtime.movement ?? null,
      action: payload?.action ?? prev.runtime.action ?? "idle",
      status: payload?.status
        ? {
            ...(prev.runtime.status ?? {}),
            ...payload.status,
          }
        : prev.runtime.status,
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
