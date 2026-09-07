# Week 2: JavaParser and Whole-Project Model

## Task
Move from file discovery to structural understanding of Java source code.

## Contribution
I worked with JavaParser to parse real source files and extract classes, methods, return types, parameters and source positions. This was extended from a single source file to a whole-project `ProjectModel` using `ClassInfo` and `MethodInfo`.

## Validation
On `minimal-json`, the model produced 63 classes and 912 methods. Later relationship extraction recorded 2,931 method calls with zero parse warnings on the reference run.

## Key learning
AST-based analysis is much safer than matching source text because it provides explicit syntax structure and source locations that later rules can consume.
