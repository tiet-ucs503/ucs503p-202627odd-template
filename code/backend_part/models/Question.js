const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    topic: {
      type: String,
      required: true,
      trim: true
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true
    },
    platform: {
      type: String,
      trim: true,
      default: ""
    },
    link: {
      type: String,
      trim: true,
      default: ""
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    },
    confidence: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    dateSolved: {
      type: Date,
      default: Date.now
    },
    lastRevised: {
      type: Date,
      default: null
    },
    nextRevision: {
      type: Date,
      default: Date.now,
      index: true
    },
    revisionCount: {
      type: Number,
      default: 0,
      min: 0
    },
    solveCount: {
      type: Number,
      default: 1,
      min: 1
    },
    priority: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

questionSchema.index({ userId: 1, nextRevision: 1 });
questionSchema.index({ userId: 1, topic: 1 });
questionSchema.index({ userId: 1, difficulty: 1 });

module.exports = mongoose.model("Question", questionSchema);
