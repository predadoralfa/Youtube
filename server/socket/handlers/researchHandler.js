"use strict";

const { getRuntime } = require("../../state/runtimeStore");
const { ensureResearchLoaded, buildResearchPayload, startResearch } = require("../../service/researchService");

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function registerResearchHandler(io, socket) {
  function requireUser() {
    const userId = socket.data.userId;
    if (!userId) throw new Error("Socket not authenticated");
    return userId;
  }

  socket.on("research:request_full", async (_intent, ack) => {
    try {
      const userId = requireUser();
      const rt = getRuntime(userId);
      const research = await ensureResearchLoaded(userId, rt, { forceReload: true });
      const payload = buildResearchPayload({ research });
      socket.emit("research:full", payload);
      safeAck(ack, payload);
    } catch (error) {
      safeAck(ack, {
        ok: false,
        code: error?.message || "RESEARCH_ERR",
        message: error?.message || "Research request failed",
      });
    }
  });

  socket.on("research:start", async (intent = {}, ack) => {
    try {
      const userId = requireUser();
      const result = await startResearch(userId, intent?.researchCode);
      if (result?.ok !== true) {
        safeAck(ack, result);
        return;
      }

      socket.emit("research:full", result.research);
      safeAck(ack, result);
    } catch (error) {
      safeAck(ack, {
        ok: false,
        code: error?.message || "RESEARCH_ERR",
        message: error?.message || "Research start failed",
      });
    }
  });
}

module.exports = {
  registerResearchHandler,
};
