# AlgoRecall

**A deterministic, personalized revision management system for Data Structures and Algorithms (DSA) preparation.**

AlgoRecall is a web-based learning platform designed to help students systematically revise previously solved DSA problems. Instead of relying on manual revision tracking, AlgoRecall maintains question-level revision history and uses a deterministic scheduling and prioritization system to recommend the most relevant question for revision each day.

The system combines **confidence level, question difficulty, revision recency, and revision frequency** to determine revision priority and schedule subsequent reviews.

---

## Overview

While solving DSA problems is an essential part of technical interview preparation, retaining previously learned problem-solving patterns requires consistent revision. Manually tracking which problems need to be revisited, when they were last solved, and how confidently they can be solved becomes increasingly difficult as the problem set grows.

AlgoRecall addresses this by providing a centralized revision workflow:

```text
Solve Question
      ↓
Record Question & Confidence
      ↓
Schedule Future Revision
      ↓
Identify Due Questions
      ↓
Calculate Revision Priority
      ↓
Recommend One Question
      ↓
Revise & Update Confidence
      ↓
Record Revision History
      ↓
Schedule Next Revision
```

---

## Key Features

### Question Management

Users can maintain a structured collection of solved DSA problems with attributes including:

* Question title
* Platform
* Topic
* Difficulty
* Confidence level
* Date solved
* Last revision date
* Next scheduled revision
* Revision count

### Deterministic Revision Scheduling

AlgoRecall uses a transparent, parameter-based scheduling mechanism rather than machine learning.

The scheduling system considers:

* Current confidence level
* Question difficulty
* Previous revision interval
* Revision history

Confidence levels determine the base revision interval, while question difficulty can modify the interval to prioritize more challenging problems.

### Daily Recommendation

When multiple questions are due for revision, AlgoRecall calculates a priority score for each question.

The priority is based on factors such as:

```text
Confidence Need
      +
Question Difficulty
      +
Time Since Last Revision
      +
Revision Frequency
      ↓
Priority Score
```

The highest-priority question is selected as the user's daily recommendation.

This makes the recommendation system **deterministic, explainable, and reproducible**.

### Due Today Dashboard

Users can view questions that are currently due for revision and access their recommended question directly from the dashboard.

### Revision History

Every revision activity is recorded, including:

* Revision timestamp
* Previous confidence
* Updated confidence
* Revision number

This allows the system to maintain a complete history of the user's revision activity.

### Analytics Dashboard

AlgoRecall provides learning analytics including:

* Overall revision progress
* Topic-wise performance
* Confidence distribution
* Revision frequency
* Revision consistency
* Difficulty-wise revision statistics

### Search & Filtering

Users can quickly locate questions using filters such as:

* Topic
* Platform
* Difficulty
* Confidence
* Revision status
* Date ranges

---

## System Architecture

AlgoRecall follows a conventional three-tier web architecture.

```text
┌─────────────────────────────┐
│          Frontend           │
│       React + Tailwind      │
└──────────────┬──────────────┘
               │
               │ REST API
               ↓
┌─────────────────────────────┐
│          Backend            │
│      Node.js + Express      │
│                             │
│  Authentication             │
│  Question Management        │
│  Scheduling Engine          │
│  Recommendation Engine      │
│  Revision Management        │
│  Analytics                  │
└──────────────┬──────────────┘
               │
               │ MongoDB Driver
               ↓
┌─────────────────────────────┐
│        MongoDB Atlas        │
│                             │
│  Users                      │
│  Questions                  │
│  Revision History           │
└─────────────────────────────┘
```

---

## Technology Stack

### Frontend

* React.js
* Tailwind CSS

### Backend

* Node.js
* Express.js
* RESTful APIs
* JWT-based authentication

### Database

* MongoDB Atlas

### Development & Deployment

* Git
* GitHub
* GitHub Actions
* Cloud-based deployment

---

## Revision Scheduling Model

AlgoRecall intentionally uses a deterministic scheduling model rather than an ML-based recommendation system.

A question's revision priority is calculated using weighted parameters:

```text
Priority Score =
    w₁ × Confidence Need
  + w₂ × Difficulty
  + w₃ × Revision Recency
  + w₄ × Revision Frequency
```

The weights can be tuned during development based on system evaluation.

The scheduling component separately determines the next revision interval based on the user's updated confidence and question difficulty.

This separation allows the system to answer two distinct questions:

**Scheduling:**

> When should this question be revised again?

**Recommendation:**

> Which question should be revised today?

---

## Core API Modules

The backend is organized around the following functional modules:

```text
Authentication
├── Registration
└── Login

Questions
├── Create
├── Retrieve
├── Update
├── Delete
└── Search & Filter

Revisions
├── Record Revision
├── Update Confidence
├── Schedule Next Revision
└── Revision History

Dashboard
├── Due Today
├── Daily Recommendation
└── Revision Statistics

Analytics
├── Topic Performance
├── Confidence Distribution
├── Revision Progress
└── Revision Consistency
```

---

## Data Model

### User

```text
User
├── name
├── email
├── password
└── createdAt
```

### Question

```text
Question
├── userId
├── title
├── platform
├── topic
├── difficulty
├── confidence
├── dateSolved
├── lastRevised
├── nextRevision
├── revisionCount
└── priority
```

### Revision History

```text
RevisionHistory
├── userId
├── questionId
├── revisedAt
├── previousConfidence
├── newConfidence
└── revisionNumber
```

---

## Design Principles

AlgoRecall is designed around the following principles:

* **Simplicity** — Keep the system practical for students preparing for technical interviews.
* **Explainability** — Recommendations should have an understandable reason behind them.
* **Determinism** — Identical question states should produce consistent scheduling decisions.
* **Maintainability** — Separate scheduling, recommendation, and data management logic.
* **Scalability** — Use a modular REST API architecture suitable for cloud deployment.
* **Accessibility** — Provide a responsive interface across commonly used devices.

---

## CI/CD

The project uses CI/CD practices to support reliable and repeatable development.

The pipeline is intended to:

1. Validate code changes.
2. Run automated tests.
3. Build the application.
4. Generate deployment-ready artifacts.
5. Deploy validated changes to the target environment.

This enables incremental development while reducing the risk of introducing regressions into the application.

---

## Project Scope

AlgoRecall is an engineering-focused educational project. The objective is to demonstrate the design and implementation of a practical revision management system rather than develop a novel learning or machine-learning algorithm.

The recommendation engine therefore prioritizes **transparency, correctness, and ease of implementation** over algorithmic complexity.

---

## Future Enhancements

Potential future improvements include:

* Personalized scheduling based on long-term revision behavior
* Additional spaced-repetition strategies
* Performance-based topic recommendations
* Streaks and revision goals
* Advanced analytics
* Calendar integration
* Importing solved problems from coding platforms
* Progressive refinement of scheduling parameters using historical user data

---

## Project Status

**Status:** In Development

AlgoRecall is currently being developed as a web-based DSA revision and learning analytics platform.

---