# Week 2: Multi-Scanner Engine Integration & Two-Tier Deduplication

**Author**: Rajat (1024030696)  
**Collaborators**: Vidhi (1024030700), Yashti (1024030701)  
**Date**: September 2026

---

## 1. Objectives & Overview

In Week 2, our primary goal was building the core `SecurityEngine` pipeline that coordinates the three scanners (**Gitleaks**, **OSV-Scanner**, and **Semgrep**), parses their heterogeneous outputs, and normalizes them into our unified `Finding` structure.

A major challenge we encountered during testing was **alert fatigue and duplicate findings**:
- When multiple Semgrep rules triggered on the same line of code (e.g., three different SQL injection or path traversal rules targeting one statement), developers received repetitive, cluttering warnings.
- Multiple tools occasionally flagged the exact same token or dependency.

To solve this, I designed and implemented a **two-tier deduplication engine** and hardened our scanner wrappers for cross-platform execution.

---

## 2. Key Contributions

### A. Subprocess Management & Scanner Wrappers
- I implemented the subprocess execution wrappers for Semgrep (`scanners/semgrep_scanner.py`) and OSV-Scanner (`scanners/osv_scanner.py`).
- **Subprocess Isolation**: Configured `subprocess.run` with deterministic timeouts, UTF-8 output decoding, and graceful error recovery so that a failure in one scanner does not crash the entire security engine.
- **Cross-Platform Compatibility**:
  - Initially, the OSV wrapper assumed `osv-scanner.exe`, which failed on macOS and Linux systems. I updated the wrapper to dynamically search `PATH` for the native `osv-scanner` binary before falling back to local files.
  - Implemented virtualenv auto-detection for Semgrep to automatically find the active Python virtual environment's `semgrep` binary.

### B. Designing Two-Tier Deduplication (`security_engine.py`)
To ensure high signal-to-noise ratio in security reports, I implemented a two-tier deduplication algorithm in `_deduplicate()`:

1. **Tier 1 (Exact Fingerprint Match)**:
   - Evaluates a deterministic MD5/SHA-256 fingerprint generated from `tool:rule:file:line`.
   - Eliminates redundant scanner re-runs and duplicate rule outputs.

2. **Tier 2 (Same-Line Multi-Rule Consolidation)**:
   - For line-based findings (lines > 0 in the same file), findings are grouped by `(file, line)`.
   - When multiple rules fire on the same line:
     - The consolidated finding inherits the **highest severity** among all matching rules (`CRITICAL` > `HIGH` > `MEDIUM` > `LOW` > `INFO`).
     - Rule names are merged cleanly into a composite string (e.g., `rule-a | rule-b`).
     - Descriptions and fix recommendations are aggregated into a comprehensive remediation guide.
   - For file-level findings (line 0 / `None`, common in OSV dependency CVEs), findings are preserved individually to avoid merging separate package advisories.

### C. Testing & Validation (`tests/test_engine.py`)
I created a comprehensive unit test suite with 6 test cases verifying:
- Multi-rule consolidation on the same line.
- Preservation of individual dependency CVEs on line 0.
- Scanner failure resilience: the engine completes with `ok: false` status for a failed scanner while successfully reporting findings from the other two.
- JSON contract conformance for downstream consumers.

---

## 3. Team Collaboration

- **Assisting Vidhi**: Vidhi worked on refining the Gitleaks regex rules and secret severity mapping (`gitleaks_scanner.py`). I assisted her in standardizing the start and end column numbers so they align with VS Code's text selection ranges.
- **Assisting Yashti**: Yashti implemented the HTML report generator (`reporting/html_report.py`). I collaborated with her on escaping raw vulnerability code snippets in HTML and linking OSV CVE identifiers to the official Open Source Vulnerabilities database.

---

## 4. Key Learnings & Outcome

- **Resilient Software Design**: In security engineering, third-party CLI tools have diverse exit codes (e.g., exit code 1 can mean "vulnerabilities found" rather than a system crash). Proper exit code mapping is essential.
- **Deduplication Quality**: Consolidating same-line alerts reduced report clutter by ~40% on vulnerable benchmark applications, significantly improving developer readability.
