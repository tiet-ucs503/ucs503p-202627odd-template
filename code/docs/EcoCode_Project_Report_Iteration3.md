# ECOCODE
## Green-Software Analysis Platform
### UCS503 Software Engineering Project — Mid-Semester Prototype

**Team:** Gurnoor · Rakesh · Manav  
**Current scope:** Iterations 1–3 — static-analysis foundation, static relationships, deterministic rule engine

---

## 1. Problem Statement

Modern Java applications may waste CPU time, memory, database operations and other resources because inefficient source-code patterns are difficult to identify during ordinary development. EcoCode is being developed as a deterministic software-analysis platform that identifies such patterns and reports where they occur, why they matter and how they may be improved.

The final project vision also includes runtime evidence, benchmarking, version comparison and green-software reporting. Those later subsystems are outside the current Iteration-3 presentation snapshot.

## 2. Current Prototype Scope

### Iteration 1 — Foundation — Complete

- Gradle / Java 21 project setup
- Recursive Java project discovery using `ProjectIndexer`
- `JavaFileInfo` metadata: file path, line count and test/production classification
- JavaParser AST parsing
- project-wide `ClassInfo`, `MethodInfo` and `ProjectModel`
- whole-project extraction instead of single-file analysis

### Iteration 2 — Static Relationships — Implemented Prototype

- method-call extraction using JavaParser `MethodCallExpr`
- caller, callee name, scope, arguments, line number and loop-context metadata
- lightweight deterministic symbol resolution
- call-graph construction from resolved caller → callee relationships
- breadth-first reachability, depth-first `canReach`, and call-chain depth calculation

**Important accuracy statement:** the current `SymbolSolver` is EcoCode's lightweight heuristic resolver. It uses caller context, field types, explicit scopes, method names and argument counts. Full JavaParser semantic type resolution remains an accuracy improvement for a later refinement.

### Iteration 3 — Deterministic Static Rules — Implemented, Validation Ongoing

EcoCode currently contains a common `EcoRule` contract, a `RuleEngine`, and implementations for:

| Rule | Name | Severity | Current intent |
|---|---|---:|---|
| EC101 | Repeated Database Call in Loop | HIGH | Flag likely DB/heavy calls repeated by loop iterations. |
| EC102 | String Concatenation in Loop | MEDIUM | Detect repeated immutable-string concatenation in loops. |
| EC103 | Linear Collection Lookup in Loop | MEDIUM | Detect `contains` / `indexOf` patterns on list-like collections inside loops. |
| EC104 | Unbounded Collection Fetch | HIGH | Detect no-argument `findAll()`-style retrieval without pagination. |
| EC105 | Repeated Allocation Hot Path | LOW | Detect loop-local allocations with constant/empty constructor arguments. |
| EC106 | Deep Call Chain | LOW | Report public entry points whose call-graph depth exceeds the configured threshold. |
| EC107 | Resource Handling | HIGH | Detect supported resource variables not declared in try-with-resources. |
| EC108 | Duplicate Computation | MEDIUM | Detect repeated identical calls with identical argument text inside one method. |

JUnit test classes are currently present for EC101, EC102 and EC103. The remaining rules require broader automated regression coverage and continued false-positive refinement.

## 3. Architecture of the Current Snapshot

```text
Java project path
      ↓
ProjectIndexer
      ↓
List<JavaFileInfo>
      ↓
JavaProjectParser
      ↓
ProjectModel
  ├── ClassInfo
  │     └── MethodInfo
  │            └── MethodCallInfo
  ├── loop string-concat events
  ├── loop allocation events
  └── resource-handling events
      ↓
SymbolSolver
      ↓
CallGraph
      ↓
RuleEngine
  └── EC101–EC108
      ↓
List<StaticIssue>
```

This separation keeps filesystem discovery, AST extraction, program relationships and rule execution as distinct responsibilities.

## 4. Key Data Models

### `JavaFileInfo`
Stores physical-source information discovered by the indexer:
- file name
- `Path`
- line count
- test/production flag

### `ClassInfo`
Stores project-level class identity and structural information:
- qualified name
- simple name
- package name
- source file path
- test/production classification
- fields and their declared types
- methods
- repository/DAO heuristic flag

### `MethodInfo`
Stores:
- method name and return type
- parameter types and names
- start/end source lines
- public/non-public status
- method-call list

### `MethodCallInfo`
Stores a call site:
- callee name
- optional scope
- argument expressions
- source line
- whether the call occurs inside a loop
- caller class and method
- resolved target when available

## 5. Verified Foundation Result

The earlier foundation was run against the open-source `minimal-json` repository and produced the following verified project summary:

- **54** Java files
- **37** production files
- **17** test files
- **10,870** lines
- **63** discovered classes
- **912** discovered methods

These results established that the indexer and whole-project parser work on a real multi-file project rather than only on toy snippets.

## 6. Use Cases for the Current Prototype

### UC-01 — Analyze Local Java Project
**Actor:** Developer  
**Input:** local project path  
**Flow:** index files → parse AST → build project model → resolve calls → build call graph → execute rules  
**Output:** project summary and static issues

### UC-02 — Inspect Static Finding
**Actor:** Developer  
**Input:** detected issue  
**Output:** rule ID, severity, confidence, file, line, class, method, explanation, recommendation and trade-off text

## 7. Current Constraints and Limitations

- Analysis is Java-oriented.
- Symbol resolution is currently heuristic rather than full semantic type solving.
- Method IDs currently emphasize class + method name; overload-aware graph identity can be strengthened further.
- EC102 string-expression recognition uses deterministic textual heuristics and can be refined.
- EC103 uses naming heuristics to distinguish list-like and set-like scopes.
- EC107 recognizes a configured family of Java/JDBC resource types and may over-report cases closed manually later in a method.
- EC108 compares textual call forms and therefore needs exclusions/refinements for stateful APIs.
- Dedicated automated tests are currently present for EC101–EC103; EC104–EC108 need equivalent regression suites.

These are prototype limitations to be measured and reduced through repository testing, not hidden assumptions.

## 8. Iteration Roadmap

### Current presentation boundary
1. **Iteration 1 — Foundation** — complete
2. **Iteration 2 — Static Relationships** — implemented prototype
3. **Iteration 3 — Rules** — implementations present; validation/refinement ongoing

### Planned after this presentation
- Build Engine
- Docker execution
- Benchmark Manager
- JFR/runtime profiling
- database and HTTP/network analysis
- evidence engine
- recommendation engine
- version comparison
- Git/JGit integration
- dashboard/UI
- complete self-testing and green-software evidence

## 9. Evaluation Plan

1. Add positive and negative JUnit fixtures for EC104–EC108.
2. Run the analyzer against multiple external Java repositories.
3. Manually inspect samples of findings to estimate false positives / false negatives.
4. Strengthen symbol resolution and overloaded-method identity.
5. Preserve reproducible project statistics and rule-count outputs for each test repository.

## 10. Conclusion

At the Iteration-3 boundary, EcoCode is a standalone static-analysis prototype rather than a finished full-stack product. Its implemented core can recursively index real Java projects, build an AST-backed project model, extract method calls, construct a lightweight resolved call graph and execute eight deterministic rule implementations. The next stage is broader validation and runtime intelligence, not presentation-layer expansion.
