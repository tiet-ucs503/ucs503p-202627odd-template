const express = require("express");
const router = express.Router();
const { registerWorkerProfile, getWorkerById } = require("../controllers/workerController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", protect, authorize("worker"), registerWorkerProfile);
router.get("/:id", getWorkerById);

module.exports = router;

