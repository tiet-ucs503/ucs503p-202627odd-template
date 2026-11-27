const Question = require("../models/Question");
const {
  calculatePriority,
  calculateNextRevision
} = require("../services/schedulingService");

async function createQuestion(req, res, next) {
  try {
    const {
      title,
      topic,
      difficulty,
      platform,
      link,
      confidence = 3,
      dateSolved
    } = req.body;

    if (!title || !topic || !difficulty) {
      return res.status(400).json({
        message: "title, topic and difficulty are required"
      });
    }

    const solvedAt = dateSolved ? new Date(dateSolved) : new Date();

    if (Number.isNaN(solvedAt.getTime())) {
      return res.status(400).json({ message: "Invalid dateSolved" });
    }

    const questionData = {
      userId: req.userId,
      title,
      topic,
      difficulty,
      platform,
      link,
      confidence: Number(confidence),
      dateSolved: solvedAt,
      lastRevised: null
    };

    const question = new Question(questionData);

    question.nextRevision = calculateNextRevision(
      question,
      question.confidence,
      solvedAt
    );

    question.priority = calculatePriority(question, new Date());

    await question.save();

    res.status(201).json({ question });
  } catch (error) {
    next(error);
  }
}

async function getQuestions(req, res, next) {
  try {
    const {
      topic,
      difficulty,
      platform,
      confidence,
      status,
      search
    } = req.query;

    const filter = { userId: req.userId };

    if (topic) filter.topic = new RegExp(topic, "i");
    if (difficulty) filter.difficulty = difficulty;
    if (platform) filter.platform = new RegExp(platform, "i");
    if (confidence) filter.confidence = Number(confidence);

    if (search) {
      filter.$or = [
        { title: new RegExp(search, "i") },
        { topic: new RegExp(search, "i") },
        { platform: new RegExp(search, "i") }
      ];
    }

    const questions = await Question.find(filter).sort({
      nextRevision: 1,
      priority: -1
    });

    const now = new Date();

    const result = questions.map((question) => {
      const plain = question.toObject();
      plain.priority = calculatePriority(question, now);
      plain.isDue = new Date(question.nextRevision) <= now;
      return plain;
    });

    let filtered = result;

    if (status === "due") {
      filtered = result.filter((question) => question.isDue);
    }

    if (status === "upcoming") {
      filtered = result.filter((question) => !question.isDue);
    }

    res.json({
      count: filtered.length,
      questions: filtered
    });
  } catch (error) {
    next(error);
  }
}

async function getQuestion(req, res, next) {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json({ question });
  } catch (error) {
    next(error);
  }
}

async function updateQuestion(req, res, next) {
  try {
    const allowedFields = [
      "title",
      "topic",
      "difficulty",
      "platform",
      "link",
      "confidence",
      "dateSolved",
      "notes"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const question = await Question.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    question.priority = calculatePriority(question);
    await question.save();

    res.json({ question });
  } catch (error) {
    next(error);
  }
}

async function deleteQuestion(req, res, next) {
  try {
    const question = await Question.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createQuestion,
  getQuestions,
  getQuestion,
  updateQuestion,
  deleteQuestion
};
