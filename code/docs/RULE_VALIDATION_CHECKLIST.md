# EcoCode Iteration 3 — Rule Validation Checklist

Use this after the Iteration-3 code freeze.

## 1. Automated tests

```bash
./gradlew clean test
```

Record whether the suite passes.

## 2. Run reference repository

```bash
./gradlew run --args="/path/to/minimal-json --details=5"
```

The summary and the detailed samples must come from the same run.

## 3. Manual audit

Inspect the source at every sampled file/line. Classify each sampled finding as:

- **TP** — true positive / legitimate potential inefficiency
- **FP** — false positive
- **UNCERTAIN** — needs type/runtime information

Priority:

- EC101: inspect all findings
- EC102: 3 samples
- EC103: 3 samples
- EC104: all findings
- EC105: 5 samples
- EC106: 5 samples
- EC107: 8 samples
- EC108: 10 samples

Do not call the total issue count a total bug count. Use **static findings** or **potential inefficiencies**.

## 4. Multi-repository validation

For each real repository record:

| Repository | Java files | LOC | Classes | Methods | Calls | Graph nodes | Parse warnings | Issues |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| minimal-json | | | | | | | | |
| repo 2 | | | | | | | | |
| repo 3 | | | | | | | | |

## 5. Freeze criteria before presentation

- Build/tests pass.
- `minimal-json` reproduces expected structural counts.
- Parse warnings are explained.
- EC101/EC104 findings are manually checked in full.
- Obvious EC107/EC108 false-positive classes are fixed or explicitly documented.
- Presentation labels rules as deterministic static findings, not confirmed runtime bugs.
