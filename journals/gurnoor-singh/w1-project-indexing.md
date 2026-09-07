# Week 1: Project Indexing and Java Metadata

## Task
Build the foundation required to analyse a complete Java repository rather than a single source snippet.

## Contribution
I worked on the initial `ProjectIndexer` and `JavaFileInfo` model. The indexer recursively walks a project directory, selects `.java` files, counts source lines, and classifies source files as test or non-test code.

## Validation
Using the `minimal-json` repository, the indexer identified:

- 54 Java files
- 37 non-test source files
- 17 test files
- 10,870 lines

## Key learning
A whole-project analyser first needs a reliable inventory of the repository. This became the input layer for JavaParser and the later analysis pipeline.
