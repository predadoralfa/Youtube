export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `${hours}h ${restMinutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function resolveNodeTone(code) {
  const normalized = String(code ?? "").toUpperCase();
  if (normalized.includes("APPLE")) return "apple";
  if (normalized.includes("FIBER") || normalized.includes("GRASS")) return "fiber";
  if (normalized.includes("SHELTER")) return "shelter";
  return "stone";
}

export function deriveLiveStudy(node, serverNowMs, clientNowMs) {
  const progressMs = Number(node?.progressMs ?? 0);
  const levelStudyTimeMs = Number(node?.levelStudyTimeMs ?? 0);
  const isRunning = node?.isRunning === true;
  const elapsedSincePayload = Math.max(0, Number(clientNowMs ?? 0) - Number(serverNowMs ?? 0));
  const effectiveProgressMs = isRunning
    ? Math.min(levelStudyTimeMs, progressMs + elapsedSincePayload)
    : progressMs;
  const remainingMs = Math.max(0, levelStudyTimeMs - effectiveProgressMs);
  const progressRatio =
    levelStudyTimeMs > 0 ? Math.max(0, Math.min(1, effectiveProgressMs / levelStudyTimeMs)) : 0;

  return {
    effectiveProgressMs,
    remainingMs,
    progressRatio,
  };
}
