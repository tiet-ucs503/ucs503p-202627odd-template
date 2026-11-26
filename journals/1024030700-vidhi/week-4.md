# ThreatLens – Week 4 Progress

## Work Completed

### Phase 9 – Severity Classification
Added a configurable severity layer so findings can be classified as:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

Example mappings include:

```text
generic-api-key → HIGH
CVSS ≥ 9.0      → CRITICAL
```

### Phase 10 – Explanation, Risk and Remediation
Extended each `Finding` with human-readable information:

```text
description      → What is wrong?
risk             → Why is it dangerous?
recommendation   → How can it be fixed?
```

This converts raw scanner output into information that a developer can understand.

### Phase 11 – Security Report Generator
Created:

```text
reporting/report_generator.py
```

The report generator collects the normalized findings and creates a readable security report.

The complete CLI can be executed with:

```bash
python threatlens.py ./test-repo
```

The command:

```text
python
  |
threatlens.py
  |
SecurityEngine
  |
Gitleaks + OSV-Scanner + Semgrep
  |
Normalize + Deduplicate + Sort
  |
Report Generator
  |
ThreatLens Security Report
```

A different repository can also be scanned by providing its path:

```bash
python threatlens.py "C:\Users\ASUS\Desktop\MyOtherProject"
```

The report contains information such as:

```text
Repository
Scan time
Finding count
Severity
Tool
Category
File
Line
Description
Risk
Recommendation
```

Actual secret values are not displayed.

### Phase 12 – End-to-End Testing
The complete pipeline was tested using the controlled:

```text
test-repo/
```

The main demonstration command is:

```bash
python threatlens.py ./test-repo
```

The output shows findings from all three scanners in one developer-friendly report.

## Difficulties Faced

- Raw scanner output was technical and inconsistent.
- Security findings needed to be understandable to a developer.
- Actual secrets must never appear in the final report.
- The project needed a simple way to demonstrate the complete workflow from the terminal.

## How It Was Fixed

- Added severity classification.
- Added plain-English descriptions, risks and recommendations.
- Added secret redaction.
- Created `threatlens.py` as a single command-line entry point for the complete scan.

## Outcome

Stage 3 was completed successfully. ThreatLens now provides a complete local workflow:

```text
Repository
    |
Security Scan
    |
Gitleaks + OSV + Semgrep
    |
Unified Findings
    |
Severity + Explanation
    |
Security Report
```
