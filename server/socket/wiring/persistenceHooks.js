// server/socket/wiring/persistenceHooks.js

const { onEntityDespawn } = require("../../state/persistenceManager");

let _despawnHookInstalled = false;

function installPersistenceHooks(io) {
  if (_despawnHookInstalled) return;
  _despawnHookInstalled = true;

  // OFFLINE definitivo -> despawn autoritativo
  onEntityDespawn((evt) => {
    try {
      const entityId = String(evt.entityId);
      const instanceId = String(evt.instanceId);
      const rev = Number(evt.rev ?? 0);

      // dedup de rooms alvo
      const targets = new Set();
      targets.add(`inst:${instanceId}`);

      if (Array.isArray(evt.interestRooms)) {
        for (const r of evt.interestRooms) targets.add(String(r));
      }

      const payload = { entityId, rev };

      for (const room of targets) {
        io.to(room).emit("entity:despawn", payload);
      }
    } catch (e) {
      console.error("[SOCKET] despawn hook error:", e);
    }
  });
}

module.exports = {
  installPersistenceHooks,
};
