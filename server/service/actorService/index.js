"use strict";

const { resolveActorDef } = require("./defs");
const { ensureActorContainer } = require("./containers");
const { createRuntimeActor, createActorWithContainer } = require("./runtime");

module.exports = {
  createRuntimeActor,
  createActorWithContainer,
  ensureActorContainer,
  resolveActorDef,
};
