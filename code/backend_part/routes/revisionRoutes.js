const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  reviseQuestion,
  getHistory
} = require("../controllers/revisionController");

const router = express.Router();

router.use(authMiddleware);

router.post("/:questionId", reviseQuestion);
router.get("/history/all", getHistory);

module.exports = router;
