function clearPlayerCombat(runtime) {
  if (!runtime?.combat) return false;

  const wasEngaged = runtime.combat.state === "ENGAGED" || runtime.combat.targetId != null;

  runtime.combat.state = "IDLE";
  runtime.combat.targetId = null;
  runtime.combat.targetKind = null;
  runtime.interact = null;

  return wasEngaged;
}

module.exports = {
  clearPlayerCombat,
};
