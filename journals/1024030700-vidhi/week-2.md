# ThreatLens – Week 2 Progress

## Work Completed

### Phase 0 – Tool Installation
Installed and verified the security tools required by ThreatLens:

```bash
gitleaks version
osv-scanner --version
semgrep --version
```

These commands confirm that Gitleaks, OSV-Scanner and Semgrep are available from the terminal.

### Phase 1 – Manual Gitleaks Testing
Created a controlled `test-repo` containing fake credentials and tested Gitleaks directly:

```bash
gitleaks detect --source ./test-repo --report-format json --report-path gitleaks-report.json
```

This scans the repository and stores the detected secrets in JSON format.

### Phase 2 – Python Integration
Created:

```text
scanners/gitleaks_scanner.py
```

Python uses `subprocess.run()` to execute the Gitleaks command programmatically instead of requiring the user to run it manually.

Conceptually:

```python
subprocess.run([
    "gitleaks",
    "detect",
    "--source", repo_path,
    "--report-format", "json",
    "--report-path", "gitleaks-report.json"
])
```

### Phase 3 – Parsing Results
The Python scanner reads:

```text
gitleaks-report.json
```

and converts the JSON into Python dictionaries/lists for further processing.

The secret value is redacted before the finding is returned.

## Difficulties Faced

- Gitleaks initially required correct installation/path handling.
- Gitleaks returns exit code `1` when a secret is detected, which initially looked like an execution failure.

## How It Was Fixed

- Verified the Gitleaks executable from the terminal.
- Added handling for the Gitleaks result/exit code.
- Read and parsed the generated JSON report.
- Redacted the actual secret before passing the finding forward.

## Outcome

Stage 1 was completed. ThreatLens could now execute Gitleaks from Python and obtain structured, redacted security findings.
