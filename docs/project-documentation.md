# Vigilante: Software Engineering Project Documentation

## 1. Document purpose and scope

This document describes the implemented Vigilante system, its requirements, architecture, data flow, evaluation, operational constraints, and follow-up work. It is an engineering record for reviewers, maintainers, and future contributors. It distinguishes implemented and measured behavior from design intent and future work; an intended feature must not be reported as a validated result.

## 2. Project overview

Vigilante is a personalized email prioritization system for Gmail. A global logistic-regression model estimates email importance from message text and engineered signals. A serverless processor uses the score to keep mail visible, explore borderline messages, or reversibly archive low-scoring mail under a `Vigilante/Archived` label. A per-user, sender-aware LinUCB contextual bandit learns from observed user behavior. In the final configuration, the global model makes decisions and the bandit learns in shadow mode, because the measured live comparison did not show an improvement from personalization.

### 2.1 Stakeholders and users

| Stakeholder | Need / concern |
|---|---|
| Gmail user | Find important messages, reduce inbox clutter, retain control and recover archived mail |
| Project team / maintainer | Operate the pipeline, diagnose failures, protect OAuth credentials, and measure changes honestly |
| Course evaluator | Inspect requirements, design rationale, implementation evidence, testing, and limitations |
| Google OAuth / Gmail platform | Enforce consent, scope, API, and verification policies |

### 2.2 Goals and non-goals

**Goals:** prioritize messages at cold start; adapt to individual sender engagement; make automated archiving reversible; derive labels from observable actions; compare personalization with the global baseline without training/evaluation leakage.

**Non-goals:** replace Gmail; guarantee that every important message is identified; claim that the bandit currently outperforms the baseline; infer user intent from mail the user never saw; or present a limited project evaluation as a general-population study.

## 3. Requirements

Requirements below summarize the final report and current code. They should be treated as the project baseline; future changes should record a requirement ID, rationale, implementation, and verification evidence.

### 3.1 Functional requirements

| ID | Requirement | Current implementation / evidence |
|---|---|---|
| FR-01 | A user can authorize Vigilante to access their Gmail account through OAuth. | OAuth routes and stored user connection state (`code/server/routes/auth.js`, `models/User.js`). |
| FR-02 | The system fetches new messages without repeatedly processing the full mailbox. | Gmail History API and per-user `lastHistoryId` checkpoint (`utils/gmail.js`, `utils/processor.js`). |
| FR-03 | The scoring service returns an importance score and a decision for an email or batch. | FastAPI `/score`, `/score-batch`, and `/health` endpoints (`code/scoring-service/main.py`). |
| FR-04 | The processor keeps, explores, or archives messages according to configured thresholds and mode. | Archive threshold defaults to 0.2; exploration band/rate are configurable; archive action adds the Vigilante label and removes `INBOX`. |
| FR-05 | The system records a prediction and context for each scored message, then resolves an outcome from later user behavior. | Feedback schema and reconciliation pipeline (`models/Feedback.js`, `utils/feedback.js`). |
| FR-06 | User feedback updates sender engagement statistics and per-user bandit state. | `SenderStats`, `BanditState`, and bandit update modules. |
| FR-07 | The bandit can run in shadow mode or be enabled behind safety rails. | `BANDIT_LIVE` defaults off; `BANDIT_MIN_N` defaults to 30; high global scores are protected (`utils/processor.js`). |
| FR-08 | An evaluator can compare global and personalized ranking without evaluating a record after learning from it. | Chronological, per-user prequential evaluation in `code/server/final_measure.js`. |

### 3.2 Quality requirements and acceptance evidence

| Quality attribute | Project requirement / criterion | Evidence or status |
|---|---|---|
| Correctness | A cloud scoring service should reproduce reference scores within the report’s stated tolerance of ±0.02 on ten cases. | Prototype report says this check passed. |
| Safety / reversibility | Archiving must preserve recoverability under the Vigilante label; high-confidence important mail must not be hidden by an under-trained live bandit. | Implemented in Gmail modify flow and processor guardrails; validate during deployment. |
| Reliability | History checkpoints must prevent routine polling intervals from causing missed or duplicate processing. | Checkpoint/reseed logic implemented; monitor API errors and replay behavior. |
| Performance | Process only new Gmail history and batch-score messages to limit repeated work. | Implemented; no formal latency SLO reported. |
| Privacy / security | Request only necessary Gmail scopes, protect tokens and database credentials, and avoid exposing email contents in logs. | Security controls require deployment-specific review; do not claim external audit or OAuth verification. |
| Maintainability | Keep model serving separate from Node.js orchestration and isolate scoring, feedback, sender memory, and bandit logic. | Python FastAPI scoring service and Node.js modules. |
| Usability | Explain system behavior through a clear priority/archive experience and provide recovery through Gmail labels. | Functional behavior described in reports; formal usability study not reported. |

## 4. System context and architecture

### 4.1 Component view

```text
Gmail account
    │ OAuth 2.0 / Gmail History API
    ▼
Node.js processor on AWS Lambda  ◄── EventBridge scheduled trigger
    ├── fetch new mail using per-user history checkpoint
    ├── request scores from Python FastAPI scoring service (Render)
    ├── apply keep / explore / reversible archive policy
    ├── persist feedback and context ──────────────┐
    └── reconcile later Gmail labels/actions       │
                                                   ▼
                                           MongoDB Atlas
                                      users / feedbacks /
                                      senderstats / banditstates
                                                   │
                                     per-user LinUCB learning
                                     (shadow mode by default)
```

The final report describes the global model as a separate Python microservice because the Node.js processor cannot directly load scikit-learn artifacts. The processor is a scheduled Lambda function. MongoDB Atlas stores connection/checkpoint state, feedback records, sender statistics, and bandit state.

### 4.2 Processing workflow

1. On a scheduled run, load a connected user and its Gmail history checkpoint.
2. Fetch only changes since that checkpoint. If Gmail reports an expired history ID, reseed at the current history ID and continue on a later run.
3. Score new messages using the global classifier. Build a five-element personalization context: bias, global score, smoothed sender engagement, whether the sender was seen before, and whether the message is bulk.
4. In the final shadow configuration, let the global score determine action while recording context for bandit learning. If live mode is enabled, the processor requires sufficient learned interactions and preserves a high-global-score safety rail.
5. Keep messages above the archive threshold. For the configured borderline band, keep a sample visible for exploration. Reversibly archive the remaining low-score messages under `Vigilante/Archived`.
6. Later reconcile Gmail labels/actions into honest outcomes. Read, star, and unarchive are positive signals; user archive, trash, and delete are negative signals. Automatically archived messages that were never opened are excluded from model evaluation to avoid self-confirming labels.
7. Update sender engagement and bandit state, then advance the Gmail history checkpoint.

### 4.3 Model and decision policy

The baseline is logistic regression trained on 6,000 human-verified personal and college emails. Inputs include TF-IDF representations of subject and snippet text and twelve engineered features. The report explicitly excludes post-engagement signals such as starred and Gmail “important” labels to avoid leakage. The model provides the cold-start estimate. Current code defaults to an archive threshold of 0.2; the model metadata also defines a display threshold of 0.4.

The bandit uses a five-dimensional, sender-aware context and a per-user LinUCB state with exponential forgetting. It is designed to learn individual patterns while allowing older evidence to decay. The final report found insufficient live evidence to let it control decisions, so shadow mode is the selected configuration.

## 5. Data model and information handling

| Collection / model | Main purpose | Key fields |
|---|---|---|
| `User` | Connected account and processing checkpoint | Google ID, email, OAuth tokens, token expiry, history ID, connection status |
| `Feedback` | One scored message and later outcome | Message/thread IDs, global score, action, sender/category, context, label/outcome, scored/resolved timestamps |
| `SenderStats` | Per-user engagement memory by sender | Google ID, normalized sender, seen, engaged, dismissed counts |
| `BanditState` | Per-user LinUCB learning state | Context dimension, matrix `A`, vector `b`, update count |

**Data minimization note:** Gmail message text is sent to the scoring service as needed for inference. Access tokens, refresh tokens, email metadata, and feedback are sensitive operational data. Keep secrets out of source control and logs; apply least privilege, access controls, retention limits, and a documented disconnect/deletion process before any wider deployment. The repository materials do not establish that an independent privacy or security audit has occurred.

## 6. Evaluation and results

### 6.1 Protocol

The baseline was evaluated offline on held-out data and later on live resolved feedback. For the head-to-head comparison, records were grouped by user and processed chronologically. Each bandit prediction was computed before its record updated the user state (prequential/test-then-train evaluation). Only explicit, “gold” user actions were used as labels. Untouched mail and unseen system-archived mail were not treated as negatives. ROC-AUC used tie-aware ranking. Per-user ROC-AUC was reported only when both positive and negative classes were present.

### 6.2 Reported results

| Evaluation | Model | Result |
|---|---|---:|
| Offline held-out baseline | Global logistic regression | ROC-AUC 0.949; accuracy 0.865; important-class F1 0.851 |
| Live, gold-only comparison | Global baseline | ROC-AUC 0.899 |
| Live, gold-only comparison | Bandit, prequential | ROC-AUC 0.822 |

The live comparison covered 295 honest records from 13 users (261 positive, 34 negative). Only five users had both classes, and the global baseline had higher AUC for all five. Controlled simulations demonstrated that the mechanism responds to sender engagement and can adapt after dismissals; these simulations validate mechanism behavior, not real-world superiority. The final decision was therefore to keep the global model in control and run the bandit in shadow mode.

### 6.3 Interpretation and threats to validity

- **Small negative class:** 34 negatives produce uncertain AUC estimates; most live records were positive.
- **Limited per-user coverage:** only five of thirteen users had both classes, so user-level comparison is narrow.
- **User concentration:** the final report notes that one user contributed 125 records and 23 of the 34 negatives, so the pooled result is dominated by that account.
- **Cold start:** each bandit begins from an untrained state in the prequential evaluation; this reflects initial user experience but may disadvantage a learner that needs interactions.
- **Selection and feedback bias:** only connected users and observable actions contribute labels. Untouched messages remain ambiguous, and OAuth reauthorization affects continued participation.
- **No causal claim:** the evaluation compares ranking on logged outcomes; it is not a randomized user study demonstrating improved inbox productivity.
- **Offline/live gap:** strong held-out performance does not guarantee generalization to different users, inbox distributions, or time periods.

## 7. OAuth, deployment, and operations

The final report records AWS Lambda with an EventBridge trigger, a Python scoring service hosted on Render, and MongoDB Atlas. It also reports that the trigger interval was lengthened from five to thirty minutes to control free-tier invocation usage; Gmail History API checkpoints make processing incremental despite the longer interval. Free-hosting cold starts can cause initial HTTP 503 responses until the scoring service wakes.

The OAuth application remained in testing mode during the reported work. Google documents that refresh tokens for an external app in Testing expire after seven days when scopes beyond basic identity are requested. In this project, the Gmail `modify` scope is required for reversible archive actions; broader distribution therefore depends on completing the appropriate Google OAuth readiness and restricted-scope verification steps, or restricting use to an authorized testing audience. This is a deployment constraint, not evidence that the classifier or bandit is inaccurate. See Google's current OAuth documentation in References.

**Deployment checklist:**

1. Create separate development and production configuration; do not reuse credentials across environments.
2. Configure the OAuth consent screen, test users, authorized redirect URIs, and minimum required Gmail scopes.
3. Store OAuth secrets, database URI, and service credentials in the hosting platform's secret manager; never commit them.
4. Confirm scoring service health and model artifact availability before enabling scheduled processing.
5. Confirm Lambda schedule, MongoDB network access, Gmail API quotas, and checkpoint behavior.
6. Start with `BANDIT_LIVE` disabled. Verify labels, logs, and recovery behavior using controlled accounts before changing decision mode.
7. Monitor OAuth refresh failures, history checkpoint reseeds, scoring-service cold starts, invocation cost, archive counts, and feedback resolution counts.
8. Document rollback: disable scheduled processing or `BANDIT_LIVE`, revoke OAuth access where needed, and recover messages from `Vigilante/Archived`.

## 8. Verification and testing strategy

The report and repository contain baseline test scripts and evaluation scripts. A complete maintained test plan should map each requirement to evidence:

| Test level | What to verify | Example evidence |
|---|---|---|
| Unit | Feature extraction, score/threshold mapping, context construction, sender normalization, bandit update math | Deterministic fixtures and expected outputs |
| Integration | Node processor to scoring API; Mongo persistence; Gmail label operations; feedback reconciliation | Mock Gmail/API tests and controlled test-account run |
| System | Scheduled fetch → score → action → feedback → checkpoint across multiple users | Run log with counts, IDs anonymized, and expected state transitions |
| Regression | Existing model predictions remain stable after packaging/deployment | Reference examples and tolerance, as used in prototype report |
| Evaluation | Leakage-free comparison and threshold error audit | Versioned dataset definition, class counts, script version, output, and exclusions |
| Operational | OAuth expiration/revocation, service cold start, database outage, expired history ID, retry behavior | Fault-injection or documented staging exercise |
| Security / privacy | Secret handling, access scope, log redaction, data retention, disconnect flow | Review checklist and recorded remediation; do not imply certification |

Every reported metric should record the model/artifact version, dataset period, sample size, class balance, metric definition, exclusions, and command or script used. Preserve the baseline and evaluation output so results can be reproduced.

## 9. Known limitations and roadmap

### Current limitations

- The live data set is small and highly imbalanced; per-user evidence is especially sparse.
- OAuth testing mode requires periodic reauthorization and reduces continuity of feedback collection.
- The personalization layer has not outperformed the global baseline in the reported live evaluation.
- A linear global model may miss complex interactions and may generalize poorly beyond the inboxes represented in the human-verified training data.
- Free-tier infrastructure introduces cold starts, quotas, and operational variability.
- The project report does not provide a formal latency target, large-scale load test, or independent security/privacy audit.

### Prioritized roadmap

1. **Improve evidence quality:** continue shadow-mode collection; report class balance and user coverage; target more explicit negative outcomes; repeat prequential evaluation on a later time window.
2. **OAuth continuity:** complete scope justification and required Google verification for the intended distribution model; otherwise clearly limit access to test users and account for seven-day refresh-token expiry.
3. **Safety and observability:** add alerts for token failure, scoring outage, processing lag, archive volume, and checkpoint reseeds; test recovery and disconnect flows.
4. **Evaluate operational quality:** define service-level targets for processing latency, availability, and error rates; measure cost and cold-start behavior.
5. **Broaden validation:** recruit more diverse consenting users, reduce user concentration in the evaluation, and report confidence intervals or bootstrap uncertainty where suitable.
6. **Consider model changes only with evidence:** compare calibration, threshold errors, and alternative models against the same leakage-free split before deployment.

These are proposed next steps, not completed features.

## 10. Repository map

| Path | Contents |
|---|---|
| `code/server/` | Node.js application, Gmail integration, processor, MongoDB models, bandit, evaluation scripts, final report PDF |
| `code/scoring-service/` | FastAPI baseline scoring service, feature processing, serialized model artifacts and metadata |
| `code/client/` | Client application source |
| `project-proposal/` | Proposal sources and PDF |
| `project-report-prototype-stage/` | Prototype report PDF |
| `project-report-final/` | Final-stage report directory (check repository contents; final PDF is currently under `code/server/`) |
| `journals/` | Development journals |
| `docs/` | Project documentation site sources |

## 11. References and documentation basis

The following references inform this documentation structure. They are guidance sources, not claims of formal compliance or certification:

- ISO/IEC/IEEE 29148:2018, requirements engineering and requirements-related information items: <https://www.iso.org/standard/72089.html>.
- ISO/IEC 25010:2023, product quality model: <https://www.iso.org/standard/78176.html>.
- NIST SP 800-218, Secure Software Development Framework (SSDF) v1.1: <https://csrc.nist.gov/pubs/sp/800/218/final>.
- Google OAuth 2.0 documentation, including seven-day refresh-token behavior for external apps in Testing: <https://developers.google.com/identity/protocols/oauth2>.
- Google restricted-scope verification guidance: <https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification>.
- Project final report: `code/server/Vigilante_Final_Report.pdf`.
- Project prototype report: `project-report-prototype-stage/vigilante_prototype_report.pdf`.
- Project proposal: `project-proposal/main.pdf`.

