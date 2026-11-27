const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getDueToday,
  getRecommendation,
  getAnalytics,
  getHeatmap
} = require("../controllers/dashboardController");

const router = express.Router();

router.use(authMiddleware);

router.get("/due-today", getDueToday);
router.get("/recommendation", getRecommendation);
router.get("/analytics", getAnalytics);
router.get("/heatmap", getHeatmap);

module.exports = router;
