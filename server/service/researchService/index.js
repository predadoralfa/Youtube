"use strict";

const {
  buildResearchPayload,
  hasCapability,
  listUnlockedCapabilities,
  resolveResearchModifierDelta,
  resolveResearchItemWeightDelta,
  resolveResearchItemCollectTimeDelta,
} = require("./payload");
const { ensureResearchLoaded } = require("./definitions");
const { persistDirtyResearch } = require("./persistence");
const { startResearch, processResearchTick } = require("./flow");

module.exports = {
  buildResearchPayload,
  ensureResearchLoaded,
  hasCapability,
  listUnlockedCapabilities,
  persistDirtyResearch,
  processResearchTick,
  resolveResearchModifierDelta,
  resolveResearchItemWeightDelta,
  resolveResearchItemCollectTimeDelta,
  startResearch,
};
