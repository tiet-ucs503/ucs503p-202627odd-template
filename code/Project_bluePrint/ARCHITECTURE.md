CPRecal — Recommended Folder Structure
Recommended monorepo structure. This separates the React app, Express API, shared contracts, and Tampermonkey extension while keeping the project easy to scale.
Structure
CPRecal/
│
├── README.md
├── .gitignore
├── package.json
├── .env.example
│
├── client/ # React frontend
│ ├── package.json
│ ├── src/
│ │ ├── app/
│ │ │ ├── App.jsx
│ │ │ ├── routes.jsx
│ │ │ └── providers/
│ │ │
│ │ ├── pages/
│ │ │ ├── Home/
│ │ │ ├── ProblemLibrary/
│ │ │ ├── PatternDashboard/
│ │ │ └── ProblemDetails/
│ │ │
│ │ ├── components/
│ │ │ ├── dashboard/
│ │ │ ├── problems/
│ │ │ ├── patterns/
│ │ │ ├── reviews/
│ │ │ └── common/
│ │ │
│ │ ├── services/
│ │ │ └── api.js
│ │ │
│ │ ├── hooks/
│ │ ├── context/
│ │ ├── utils/
│ │ ├── assets/
│ │ └── styles/
│ └── public/
│
├── server/ # Node + Express backend
│ ├── package.json
│ └── src/
│ ├── config/
│ │ ├── db.js
│ │ └── env.js
│ │
│ ├── models/
│ │ ├── User.js
│ │ ├── Problem.js
│ │ ├── SolvingSession.js
│ │ ├── Submission.js
│ │ ├── AcceptedSolution.js
│ │ ├── ProblemMastery.js
│ │ ├── PatternMastery.js
│ │ ├── FSRSState.js
│ │ └── ReviewHistory.js
│ │
│ ├── controllers/
│ │ ├── authController.js
│ │ ├── ingestionController.js
│ │ ├── problemController.js
│ │ ├── patternController.js
│ │ ├── dashboardController.js
│ │ └── reviewController.js
│ │
│ ├── routes/
│ │ ├── authRoutes.js
│ │ ├── ingestionRoutes.js
│ │ ├── problemRoutes.js
│ │ ├── patternRoutes.js
│ │ ├── dashboardRoutes.js
│ │ └── reviewRoutes.js
│ │
│ ├── middleware/
│ │ ├── auth.js
│ │ ├── errorHandler.js
│ │ └── validation.js
│ │
│ ├── services/
│ │ ├── mastery/
│ │ │ ├── problemMastery.js
│ │ │ ├── patternMastery.js
│ │ │ └── scoring.js
│ │ ├── fsrs/
│ │ │ ├── scheduler.js
│ │ │ └── ratingMapper.js
│ │ ├── llm/
│ │ │ └── codeAnalysis.js
│ │ ├── ingestion/
│ │ │ └── processSubmission.js
│ │ └── dashboard/
│ │ └── dashboardService.js
│ │
│ ├── utils/
│ ├── validators/
│ ├── app.js
│ └── server.js
│
├── extension/ # Tampermonkey
│ ├── cp-recal.user.js
│ ├── graphql/
│ │ ├── problemQueries.js
│ │ └── submissionQueries.js
│ ├── collectors/
│ │ ├── problemCollector.js
│ │ ├── submissionCollector.js
│ │ ├── sessionTracker.js
│ │ └── acceptedCodeCollector.js
│ ├── analysis/
│ │ ├── llmClient.js
│ │ └── efficiency.js
│ ├── ui/
│ │ └── widget.js
│ ├── storage/
│ │ └── storage.js
│ └── api/
│ └── cpRecalApi.js
│
├── shared/
│ ├── constants/
│ ├── schemas/
│ └── types/
│
├── scripts/
│ ├── seedProblems.js
│ └── importLeetCodeProblems.js
│
├── tests/
│ ├── server/
│ ├── extension/
│ └── client/
│
└── docs/
├── PROJECT_CONTEXT.md
├── AI_MASTER_CONTEXT.md
├── ARCHITECTURE.md
├── DATABASE.md
├── API.md
├── MASTERY.md
├── FSRS.md
└── EXTENSION.md
Folder Responsibilities
client: only React/UI concerns and API consumption.
server/models: MongoDB/Mongoose persistence definitions.
server/controllers: HTTP-level request/response handling.
server/services: business logic and calculations.
server/middleware: authentication, validation, and error handling.
server/services/mastery: problem and pattern mastery rules.
server/services/fsrs: rating mapping and FSRS scheduling.
server/services/llm: code-analysis integration if the backend eventually owns the LLM call.
extension: LeetCode DOM/GraphQL collection, session tracking, immediate widget UI, and API submission.
shared: constants and schemas shared by frontend/backend/extension where practical.
docs: stable project documentation that can be supplied to future AI/developers.
Important Architecture Note
The exact location of the LLM call can evolve. The product requirement is that the accepted user code is analyzed for actual and optimal complexity and that the result reaches the extension UI and backend. If security, reliability, or API-key concerns make backend-side LLM calls preferable, the extension can send the code to the backend and the backend can call the LLM, while the extension still displays the returned analysis.
