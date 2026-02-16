const Router = require("express");
const router = Router();

const { bootstrap } = require("../service/worldService");
const { requireAuth } = require("../middleware/requireAuth");

router.get("/bootstrap", requireAuth, bootstrap);

module.exports = router;
