# Week 3: Rule Correctness Audit and False-Positive Refinement

## Problem
The first complete Iteration-3 run produced 285 static findings. The raw count looked impressive, but representative samples showed that several heuristics were too broad.

## Contribution
I ran the analyser with detailed source-level output and manually inspected findings from EC101-EC108. We identified issues such as generic method names being interpreted as database calls, unsafe assumptions about repeated calls, and overly broad resource-type matching.

## Key observations
- A method named `exists()` is not automatically a database operation.
- A string expression created in a loop is different from accumulating `String` concatenation.
- `indexOf()` cannot automatically be replaced by a `HashSet` because index semantics may be required.
- Repeated object allocation is a review signal, not necessarily a defect.
- Repeated method calls should not be cached without considering purity and state changes.

## Result
After conservative rule refinement, the same reference repository produced 106 static findings instead of 285. The team treats this as false-positive refinement rather than loss of functionality.

## Current status
The eight rule implementations are present, but testing, thresholds and false-positive behaviour are still being refined. We therefore present findings as potential review candidates, not confirmed performance bugs.
