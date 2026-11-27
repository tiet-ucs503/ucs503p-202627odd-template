const DAY_MS = 24 * 60 * 60 * 1000;

const CONFIDENCE_INTERVALS = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 14
};

const DIFFICULTY_SCORE = {
  Easy: 33.33,
  Medium: 66.67,
  Hard: 100
};

const DIFFICULTY_MULTIPLIER = {
  Easy: 1.2,
  Medium: 1.0,
  Hard: 0.7
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(start, end = new Date()) {
  return Math.max(0, (end - start) / DAY_MS);
}

function calculatePriority(question, now = new Date()) {
  const confidence = Number(question.confidence || 3);

  // Lower confidence means greater need for revision.
  const confidenceNeed = ((5 - confidence) / 4) * 100;

  const difficultyScore =
    DIFFICULTY_SCORE[question.difficulty] ?? DIFFICULTY_SCORE.Medium;

  // Questions never revised are treated as highly overdue.
  const daysSinceRevision = question.lastRevised
    ? daysBetween(new Date(question.lastRevised), now)
    : daysBetween(new Date(question.dateSolved || now), now);

  const recencyScore = clamp((daysSinceRevision / 30) * 100);

  // Fewer previous revisions means greater revision need.
  const revisionCount = Number(question.revisionCount || 0);
  const frequencyScore = clamp(100 / (revisionCount + 1));

  const priority =
    0.40 * confidenceNeed +
    0.25 * difficultyScore +
    0.25 * recencyScore +
    0.10 * frequencyScore;

  return Number(priority.toFixed(2));
}

function calculateNextRevision(question, newConfidence, now = new Date()) {
  const confidence = Number(newConfidence);
  if (!CONFIDENCE_INTERVALS[confidence]) {
    throw new Error("Confidence must be between 1 and 5");
  }

  let days = CONFIDENCE_INTERVALS[confidence];

  const difficultyMultiplier =
    DIFFICULTY_MULTIPLIER[question.difficulty] ?? 1;

  days *= difficultyMultiplier;

  // A very low confidence answer should always return quickly.
  if (confidence === 1) {
    days = 1;
  }

  days = Math.max(1, Math.round(days));

  return new Date(now.getTime() + days * DAY_MS);
}

function getSchedulingDetails(question, newConfidence) {
  const nextRevision = calculateNextRevision(question, newConfidence);
  const priority = calculatePriority(
    { ...question.toObject?.() ?? question, confidence: newConfidence },
    new Date()
  );

  return {
    nextRevision,
    priority
  };
}

module.exports = {
  calculatePriority,
  calculateNextRevision,
  getSchedulingDetails,
  CONFIDENCE_INTERVALS,
  DIFFICULTY_MULTIPLIER
};
