![Tiet Logo](../assets/tiet-logo.svg){ .tiet-logo }

**UCS503: Software Engineering (Project)**  
**TIET Patiala**

# EcoCode - Green-Software Analysis Platform

EcoCode is a deterministic Java static-analysis prototype developed through iterative increments.

## Current implementation

- Iteration 1: project indexing, JavaParser and ProjectModel
- Iteration 2: method-call extraction, lightweight symbol resolution and CallGraph
- Iteration 3: deterministic rule engine EC101-EC108

The rules are implemented but are still being tested and refined for false positives. Static findings are therefore treated as review candidates rather than confirmed performance defects.

## Reference validation

On the current `minimal-json` reference run, EcoCode processed 54 Java files, 10,870 lines, 63 classes, 912 methods and 2,931 method calls with 0 parse warnings. The latest refined rule set produced 106 static findings, split into 42 non-test-source findings and 64 test-code findings.
