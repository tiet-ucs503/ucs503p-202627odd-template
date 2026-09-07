# Implementation selection for Iterations 1–3

Two codebases were compared: the earlier standalone EcoCode prototype and the later integrated application.
For overlapping components, exactly one implementation was retained.

| Component | Selected implementation | Reason |
|---|---|---|
| ProjectIndexer / JavaFileInfo | Earlier standalone prototype | Already verified on `minimal-json`; clean separation of filesystem discovery from AST parsing. |
| JavaProjectParser | Later analyzer implementation, refactored to consume ProjectIndexer output | Contains Iteration-2 method-call extraction and Iteration-3 AST event collection. |
| ClassInfo / MethodInfo / ProjectModel | Later analyzer implementation | Carries package/class identity, fields, parameters, source ranges, method calls and rule events required by Iterations 2–3. |
| MethodCallInfo | Later analyzer implementation | Only implementation containing call-site metadata. |
| SymbolSolver | Later analyzer implementation | Required by Iteration 2. Kept as a lightweight deterministic resolver; documentation explicitly avoids claiming full JavaParser semantic resolution. |
| CallGraph | Later analyzer implementation | Earlier class was only an empty placeholder; later version implements edges, BFS reachability, DFS reachability and depth. |
| EcoRule / RuleEngine | Later analyzer implementation | Earlier versions were placeholders; later versions execute the EC rule set and deduplicate findings. |
| EC101–EC108 | Later analyzer implementation | Only concrete implementations. |
| StaticIssue | Simplified standalone POJO | Preserves rule output without dragging JPA/Spring/persistence (later-iteration features) into this snapshot. |

## Removed later-iteration areas

The React UI, Spring controllers/services, persistence entities/repositories, PostgreSQL/Flyway,
JWT/security, Docker runtime profiler, EcoScore, version comparison, JGit and CI/deployment files
were intentionally excluded so the repository stops at Iteration 3.
