# EcoCode — Iteration 3 Prototype

This repository is the presentation snapshot for the first three EcoCode iterations.
It intentionally stops before web UI, persistence, Docker runtime profiling, EcoScore,
version comparison, JGit integration, and other later milestones.

## Implemented scope

### Iteration 1 — Foundation
- Gradle / Java 21 project
- `ProjectIndexer` recursive `.java` discovery
- per-file path, LOC and test/production metadata (`JavaFileInfo`)
- JavaParser AST parsing
- project-wide `ClassInfo`, `MethodInfo`, `ProjectModel`

### Iteration 2 — Static relationships
- method-call extraction (`MethodCallInfo`)
- loop-context metadata on calls
- lightweight cross-class symbol resolution (`SymbolSolver`)
- call graph construction
- reachability and call-depth traversal

> The current `SymbolSolver` is a deterministic heuristic resolver based on scope,
> field types, method name and argument count. It is **not** full JavaParser type
> resolution yet.

### Iteration 3 — Deterministic rules
- common `EcoRule` interface
- `RuleEngine`
- EC101–EC108 implementations
- JUnit tests currently included for EC101–EC103
- rule output as in-memory `StaticIssue` objects

## Explicitly outside this snapshot

- Spring Boot REST application
- React frontend
- PostgreSQL / JPA / Flyway
- authentication / JWT
- JGit cloning
- Build Engine and Docker execution
- runtime profiler / JFR
- benchmark manager
- EcoScore
- evidence engine
- version comparison

Those belong to later iterations in the roadmap.

## Run

```bash
./gradlew run --args="/absolute/path/to/a/java/project"
```

## Test

```bash
./gradlew test
```

## Architecture

```text
Project path
   ↓
ProjectIndexer
   ↓
JavaFileInfo[]
   ↓
JavaProjectParser
   ↓
ProjectModel
   ├── ClassInfo → MethodInfo → MethodCallInfo
   ├── AST rule events
   └── parse warnings
   ↓
SymbolSolver
   ↓
CallGraph
   ↓
RuleEngine (EC101–EC108)
   ↓
StaticIssue[]
```
