const mongoose = require("mongoose");

const revisionHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true
    },
    revisedAt: {
      type: Date,
      default: Date.now
    },
    previousConfidence: {
      type: Number,
      min: 1,
      max: 5
    },
    newConfidence: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    revisionNumber: {
      type: Number,
      required: true
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    },
  },
  { timestamps: true }
);

revisionHistorySchema.index({ userId: 1, revisedAt: -1 });

module.exports = mongoose.model("RevisionHistory", revisionHistorySchema);
