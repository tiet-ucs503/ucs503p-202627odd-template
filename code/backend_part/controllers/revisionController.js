const Question = require("../models/Question");
const RevisionHistory = require("../models/RevisionHistory");
const {
  calculateNextRevision,
  calculatePriority
} = require("../services/schedulingService");

async function reviseQuestion(req, res, next) {
  try {
    const { confidence ,notes=""} = req.body;
    const newConfidence = Number(confidence);

    if (!Number.isInteger(newConfidence) || newConfidence < 1 || newConfidence > 5) {
      return res.status(400).json({
        message: "confidence must be an integer from 1 to 5"
      });
    }

    const question = await Question.findOne({
      _id: req.params.questionId,
      userId: req.userId
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const previousConfidence = question.confidence;
    const revisedAt = new Date();

    question.confidence = newConfidence;
    question.lastRevised = revisedAt;
    question.revisionCount += 1;
    question.nextRevision = calculateNextRevision(
      question,
      newConfidence,
      revisedAt
    );
    question.priority = calculatePriority(question, revisedAt);
    question.notes=notes;
    await question.save();

    const history = await RevisionHistory.create({
      userId: req.userId,
      questionId: question._id,
      revisedAt,
      previousConfidence,
      newConfidence,
      revisionNumber: question.revisionCount,
      notes
    });

    res.json({
      message: "Revision recorded",
      question,
      history
    });
  } catch (error) {
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const history = await RevisionHistory.find({
      userId: req.userId
    })
      .populate("questionId", "title topic difficulty platform")
      .sort({ revisedAt: -1 });

    res.json({
      count: history.length,
      history
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { reviseQuestion, getHistory };
