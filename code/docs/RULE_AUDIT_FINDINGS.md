# EcoCode Iteration 3 — Rule Correctness Audit

## Reference run before refinement

Repository: `ralfstx/minimal-json`

- Java files: 54
- Production files: 37
- Test files: 17
- LOC: 10,870
- Classes: 63
- Methods: 912
- Method calls: 2,931
- Call-graph nodes: 468
- Parse warnings: 0
- Static findings: 285

## Audit conclusions

### EC101
The single `exists()` finding was a false positive: a generic method name was treated as database evidence. The refined rule now requires repository/DAO/database class evidence in the scope, resolved target, or reachable call graph.

### EC102
The original rule flagged any `+` expression inside loops and described it as O(N^2). That claim is only appropriate for accumulating strings. The refined parser records accumulating assignments (`+=` or self-assignment such as `s = s + x`) instead of ordinary per-iteration path construction.

### EC103
The detected `indexOf()` calls are real linear lookups, but replacing `indexOf()` with a `HashSet` can break index semantics. The rule now gives different recommendations for membership (`contains`) and index lookup (`indexOf`) and uses MEDIUM confidence.

### EC105
Allocations inside loops are not automatically bugs and may be necessary for correct semantics. Exception allocations were especially noisy. The refined rule excludes Exception/Error types, lowers confidence to LOW, and recommends profiling before reuse/hoisting.

### EC106
Deep call chains are primarily a complexity/maintainability signal, not proof of resource waste. Test classes are excluded, duplicate method-name-level findings are collapsed, and the rule explicitly documents the current overload-resolution limitation.

### EC107
The original resource matcher used substring matching, so `StringWriter` matched generic `Writer` and produced false positives. The refined parser uses exact known resource types and suppresses variables with an explicit `close()` call in the same method. The rule remains MEDIUM-confidence because ownership can be transferred.

### EC108
The original grouping ignored call scope, so calls on different objects could be grouped together. It also assumed repeated calls were safe to cache. The refined rule includes scope in its key, excludes obvious stateful/side-effecting operations, lowers confidence to MEDIUM, and makes caching conditional on purity/state.

## Important interpretation

EcoCode reports **static findings / review candidates**, not confirmed performance bugs. Runtime evidence is a later project milestone.
