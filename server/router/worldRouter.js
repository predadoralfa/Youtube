const Router = require("express");
const router = Router();

const { bootstrap } = require("../service/worldService");
const {
  getAnchor,
  getCurrentWorldTime,
  getMonths,
} = require("../service/worldClockService");
const { requireAuth } = require("../middleware/requireAuth");

router.get("/bootstrap", requireAuth, bootstrap);
router.get("/clock-anchor", requireAuth, async (_req, res) => {
  try {
    const anchor = await getAnchor();
    return res.json(anchor);
  } catch (error) {
    console.error("[WORLD CLOCK] clock-anchor failed:", error);
    return res.status(500).json({ message: "World clock unavailable" });
  }
});

router.get("/clock-time", requireAuth, async (_req, res) => {
  try {
    const worldTime = await getCurrentWorldTime();
    return res.json(worldTime);
  } catch (error) {
    console.error("[WORLD CLOCK] clock-time failed:", error);
    return res.status(500).json({ message: "World clock unavailable" });
  }
});

router.get("/calendar-months", requireAuth, async (_req, res) => {
  try {
    const months = await getMonths();
    return res.json(months);
  } catch (error) {
    console.error("[WORLD CLOCK] calendar-months failed:", error);
    return res.status(500).json({ message: "World calendar unavailable" });
  }
});

module.exports = router;
