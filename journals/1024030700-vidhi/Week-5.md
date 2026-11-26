# ThreatLens – Week 5 Progress

## Work Completed

- Prepared the **ThreatLens Prototype Stage Report** for MST evaluation, covering the problem statement, architecture, implementation, testing, results and future scope.
- Tested the end-to-end scan on the controlled `test-repo` and reviewed findings from Gitleaks, OSV-Scanner and Semgrep.
- Debugged scanner exit-code handling: exit code `1` can mean findings were detected, so it should not automatically be treated as a crash.
- Reviewed the report output and worked on making the **“How to fix”** guidance more useful, especially for vulnerable dependencies: check the patched version, upgrade the package, update `requirements.txt`/lock files, and re-run the scan.
- Reviewed the CLI reporting options: HTML report by default, terminal text using `--text`, and machine-readable JSON using `--json`.
- Reviewed JSON output intended for future VS Code integration. It includes a `schema_version`, relative file paths, severity, message, risk, fix, reference and scanner status.
- Reviewed GitHub scan workflow support in the current code, including repository/branch selection, scanning and report generation.

## Commands for Testing / Demonstration

Run a local scan and generate an HTML report:

```bash
python threatlens.py test-repo
```

Print the full text report in the terminal:

```bash
python threatlens.py test-repo --text
```

Print machine-readable JSON:

```bash
python threatlens.py test-repo --json
```

Write the HTML report without automatically opening the browser:

```bash
python threatlens.py test-repo --no-open
```

Scan a GitHub repository (requires valid GitHub authentication configured for the project):

```bash
python threatlens.py --github OWNER/REPO
```

List branches for a GitHub repository:

```bash
python threatlens.py branches OWNER/REPO
```

## Difficulties and How They Were Addressed

- **Different scanner output formats:** Each scanner's output is converted into the shared `Finding` structure before reporting.
- **Exit code `1` when findings exist:** Scanner wrappers distinguish “issues detected” from an actual execution failure.
- **Fix guidance was too general:** Reviewed the recommendations and made the dependency-fix steps more actionable. OSV recommendations direct the developer to check patched versions, update dependencies and scan again. Semgrep recommendations still include general guidance and references, so they can be improved further.
- **Reports need to support both people and programs:** HTML and text output help developers, while JSON output uses a stable schema for future integration.
- **Incomplete scans must be visible:** The report shows scanner failures instead of silently implying that all scanners completed successfully.

## Outcome

The prototype report was prepared for MST evaluation. Testing and debugging focused on the scan/report flow and making the **“How to fix”** section clearer. The controlled `test-repo` produced 36 findings in the documented run; this is a result for that test repository, not a claim about all possible vulnerabilities.

## Next Improvement

Make Semgrep recommendations more rule-specific, add automated tests for report generation and failure cases, and continue validating that sensitive values never appear in generated reports.
