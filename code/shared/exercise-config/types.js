// Shared type definitions (JSDoc @typedef).

/**
 * @typedef {Object} Landmark
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} visibility
 */

/**
 * @typedef {Object} Frame
 * @property {Landmark[]} landmarks
 * @property {number} timestampMs
 */

/**
 * @typedef {Object} FrameSource
 * @property {() => (Frame|null)} next
 */

/**
 * @typedef {Object} AngleDef
 * @property {string} id
 * @property {[string,string,string]} points
 * @property {"2d"} plane
 */

/**
 * @typedef {Object} EnterCondition
 * @property {string} signal
 * @property {"<"|">"|"approxZeroVel"} op
 * @property {number} value
 * @property {number} hysteresis
 * @property {number} minFrames
 */

/**
 * @typedef {Object} StateDef
 * @property {string} name
 * @property {EnterCondition} enterWhen
 */

/**
 * @typedef {Object} RepAngleHistory
 * @property {number} repNumber
 * @property {number} startMs
 * @property {number} endMs
 * @property {Record<string, number[]>} series
 * @property {number} [kneeOverAnkleX]
 * @property {number} [torsoLeanMax]
 * @property {number} [bottomMs]
 * @property {number} [minAngleDeg]
 * @property {number} [peakAngleDeg]
 */

/**
 * @typedef {"low"|"medium"|"high"} Severity
 * @typedef {"depth"|"knee_valgus"|"torso_lean"|"tempo"} RuleId
 */

/**
 * @typedef {Object} RuleResult
 * @property {string} ruleId
 * @property {boolean} pass
 * @property {Severity} severity
 * @property {number} measured
 * @property {string} [cue]
 */

/**
 * @typedef {Object} RuleDef
 * @property {RuleId} id
 * @property {number} priority
 * @property {Severity} severity
 * @property {(rep: RepAngleHistory, baseline?: (UserBaseline|null)) => RuleResult} evaluate
 * @property {string} feedbackPass
 * @property {string} feedbackFail
 */

/**
 * @typedef {Object} CompositeAngleDef
 * @property {string} id
 * @property {string[]} from
 */

/**
 * @typedef {Object} RepCycleThresholds
 * @property {string} signal
 * @property {number} downThresholdDeg
 * @property {number} upThresholdDeg
 * @property {number} minFrames
 */

/**
 * @typedef {Object} ExerciseConfig
 * @property {"squat"|"deadlift"|"bench"} id
 * @property {string} displayName
 * @property {boolean} enabled
 * @property {AngleDef[]} drivingAngles
 * @property {CompositeAngleDef[]} [compositeAngles]
 * @property {{dominantMotion:"hip_knee"|"elbow_shoulder", minAmplitudeDeg:number}} verification
 * @property {StateDef[]} states
 * @property {string[]} repCycle
 * @property {RepCycleThresholds} [repCycleThresholds]
 * @property {Record<string, any>|RuleDef[]} rules
 * @property {{minSec:number, maxSec:number}} tempoBounds
 * @property {Record<string, number>} scoreWeights
 * @property {number} [visibilityThreshold]
 */

/**
 * @typedef {Object} UserBaseline
 * @property {{femurToTorso:number, shinToTorso:number}} limbRatios
 * @property {{kneeStanding:number, kneeBottom:number, hipStanding:number, hipBottom:number}} rom
 * @property {Record<string, {mean:number, std:number}>} angleStats
 * @property {string} calibratedAt
 */

/**
 * @typedef {Object} RepMetrics
 * @property {number} repNumber
 * @property {number} durationSeconds
 * @property {number} romValue
 * @property {number} tempo
 * @property {Record<string, number>} angleMetrics
 */

/**
 * @typedef {Object} IssueRecord
 * @property {number} repNumber
 * @property {RuleId} issueType
 * @property {Severity} severity
 */

/**
 * @typedef {Object} SessionSummary
 * @property {string} exercise
 * @property {string} startedAt
 * @property {string} endedAt
 * @property {number} durationSeconds
 * @property {number} repCount
 * @property {number} formScore
 * @property {RepMetrics[]} reps
 * @property {IssueRecord[]} formIssues
 */

export {};
