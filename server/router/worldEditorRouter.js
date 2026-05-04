"use strict";

const Router = require("express");
const router = Router();

const { requireAuth } = require("../middleware/requireAuth");
const { requireWorldEditor } = require("../middleware/requireWorldEditor");
const {
  buildEditorBootstrap,
  listActorDefs,
  listSceneObjectDefs,
  spawnActorForEditor,
  spawnSceneObjectForEditor,
  updateActorForEditor,
  updateSceneObjectForEditor,
  disableActorForEditor,
  disableSceneObjectForEditor,
} = require("../service/worldEditorService");

router.use(requireAuth, requireWorldEditor);

router.get("/bootstrap", async (req, res) => {
  try {
    const payload = await buildEditorBootstrap(req.user.id);
    return res.json(payload);
  } catch (error) {
    console.error("[WORLD_EDITOR] bootstrap failed:", error);
    return res.status(500).json({ message: error?.message || "World editor bootstrap failed" });
  }
});

router.get("/actor-defs", async (_req, res) => {
  try {
    return res.json({ ok: true, actorDefs: await listActorDefs() });
  } catch (error) {
    console.error("[WORLD_EDITOR] actor-defs failed:", error);
    return res.status(500).json({ message: error?.message || "Actor defs unavailable" });
  }
});

router.get("/object-defs", async (_req, res) => {
  try {
    return res.json({ ok: true, objectDefs: await listSceneObjectDefs() });
  } catch (error) {
    console.error("[WORLD_EDITOR] object-defs failed:", error);
    return res.status(500).json({ message: error?.message || "Object defs unavailable" });
  }
});

router.post("/actors", async (req, res) => {
  try {
    const actor = await spawnActorForEditor(req.user.id, req.body ?? {});
    return res.status(201).json({ ok: true, actor });
  } catch (error) {
    console.error("[WORLD_EDITOR] spawn actor failed:", error);
    return res.status(400).json({ message: error?.message || "Failed to spawn actor" });
  }
});

router.post("/objects", async (req, res) => {
  try {
    const sceneObject = await spawnSceneObjectForEditor(req.user.id, req.body ?? {});
    return res.status(201).json({ ok: true, sceneObject });
  } catch (error) {
    console.error("[WORLD_EDITOR] spawn object failed:", error);
    return res.status(400).json({ message: error?.message || "Failed to spawn scene object" });
  }
});

router.patch("/actors/:id", async (req, res) => {
  try {
    const actor = await updateActorForEditor(req.user.id, req.params.id, req.body ?? {});
    return res.json({ ok: true, actor });
  } catch (error) {
    console.error("[WORLD_EDITOR] update actor failed:", error);
    return res.status(400).json({ message: error?.message || "Failed to update actor" });
  }
});

router.patch("/objects/:id", async (req, res) => {
  try {
    const sceneObject = await updateSceneObjectForEditor(req.user.id, req.params.id, req.body ?? {});
    return res.json({ ok: true, sceneObject });
  } catch (error) {
    console.error("[WORLD_EDITOR] update object failed:", error);
    return res.status(400).json({ message: error?.message || "Failed to update scene object" });
  }
});

router.delete("/actors/:id", async (req, res) => {
  try {
    const actor = await disableActorForEditor(req.user.id, req.params.id);
    return res.json({ ok: true, actor });
  } catch (error) {
    console.error("[WORLD_EDITOR] disable actor failed:", error);
    return res.status(400).json({ message: error?.message || "Failed to disable actor" });
  }
});

router.delete("/objects/:id", async (req, res) => {
  try {
    const sceneObject = await disableSceneObjectForEditor(req.user.id, req.params.id);
    return res.json({ ok: true, sceneObject });
  } catch (error) {
    console.error("[WORLD_EDITOR] disable object failed:", error);
    return res.status(400).json({ message: error?.message || "Failed to disable scene object" });
  }
});

module.exports = router;
