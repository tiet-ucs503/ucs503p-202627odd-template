# ThreatLens – Week 3 Progress

## Work Completed

### Phase 4 – Common Finding Model
Created:

```text
engine/finding.py
```

A common `Finding` dataclass was introduced so results from Gitleaks, OSV-Scanner and Semgrep could use the same structure.

Important fields include:

```python
tool
rule
category
severity
file
start_line
end_line
description
risk
recommendation
fingerprint
```

### Phase 5 – SecurityEngine
Created:

```text
engine/security_engine.py
```

The `SecurityEngine` coordinates the scanners and collects their results.

The basic flow is:

```text
SecurityEngine.scan()->Run scanners->Collect findings->Return Finding objects
```

A scanner failure is handled separately so that one failed scanner does not stop the remaining scanners.

### Phase 6 – OSV-Scanner
Created:

```text
scanners/osv_scanner.py
```

OSV-Scanner is executed from Python using a subprocess command similar to:

```bash
osv-scanner --format json <repo_path>
```

The returned vulnerability information is parsed and converted into the common `Finding` format.

### Phase 7 – Semgrep
Created:

```text
scanners/semgrep_scanner.py
```

Semgrep is executed using:

```bash
semgrep scan --config auto --json <repo_path>
```

Its results are parsed and converted into `Finding` objects.

### Phase 8 – Normalization and Deduplication
The `SecurityEngine` combines findings from all three scanners.

The results are then:

```text
Normalize
Remove duplicates
Apply severity
Sort findings
```

A duplicate is identified using information such as the same file, line and rule.

## Difficulties Faced

- Gitleaks, OSV-Scanner and Semgrep produce different JSON/output structures.
- Their findings represent different types of security problems.

## How It Was Fixed

- Introduced the common `Finding` model.
- Created a separate parser/adapter for each scanner.
- Converted every scanner's output into the same `Finding` structure.
- Added normalization, deduplication and sorting in `SecurityEngine`.

## Outcome

Stage 2 was completed. ThreatLens could run all three scanners and combine their results into one unified collection of security findings.
