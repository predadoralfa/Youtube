// server/socket/handlers/world/interest.js

const { computeChunkFromPos } = require("../../../state/presenceIndex");

function computeInterestFromRuntime(rt) {
  return computeChunkFromPos(rt.pos);
}

module.exports = {
  computeInterestFromRuntime,
};