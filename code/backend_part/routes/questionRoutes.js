const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createQuestion,
  getQuestions,
  getQuestion,
  updateQuestion,
  deleteQuestion
} = require("../controllers/questionController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createQuestion);
router.get("/", getQuestions);
router.get("/:id", getQuestion);
router.put("/:id", updateQuestion);
router.delete("/:id", deleteQuestion);

module.exports = router;
