# ThreatLens – Week 4 Progress

**Focus:** Project setup, understanding the existing code, and running ThreatLens locally before starting Stage 4.

## Work Completed

### Understanding the Codebase
Before building Stage 4 (GitHub integration), I studied how Stages 1–3 work:

```text
threatlens.py
  |
SecurityEngine            (engine/security_engine.py)
  |
Gitleaks + OSV-Scanner + Semgrep   (scanners/)
  |
Finding objects           (engine/finding.py)
  |
Deduplicate + Sort by severity
  |
Report Generator          (reporting/report_generator.py)
```

Key points I noted:

- Every scanner converts its own JSON output into the common `Finding` dataclass, so the rest of the system never deals with tool-specific formats.
- `SecurityEngine` runs each scanner inside `try/except`, so one failing scanner does not stop the others.
- Secrets found by Gitleaks are redacted before they reach a `Finding`.

### Local Setup (Windows)
Set up the project on my laptop:

```bash
python -m venv threatlens
pip install -r requirements.txt
gitleaks version          # 8.30.1
osv-scanner --version     # 2.0.2
semgrep --version         # 1.180.0
```

### Rebuilding the Test Repository
The `test-repo/` folder in the repository was empty (it had been committed as a nested git repo), so I created a new controlled test repository containing:

```text
config.py          -> fake GitHub token, fake AWS key, hardcoded password
app.py             -> SQL injection, shell injection, pickle, MD5 passwords, debug=True
requirements.txt   -> old flask / requests / jinja2 / pyyaml versions
```

and ran:

```bash
python threatlens.py ./test-repo
```

All three scanners produced findings, confirming the Stage 1–3 pipeline works on my machine.

## Difficulties Faced

- Semgrep failed with `timed out after 10 seconds` on the version check.
- Running `threatlens.py` with no folder argument scanned the whole project folder, including my virtual environment: 21 findings, 15 of them false "API keys" inside installed libraries, and Semgrep timed out after 180 seconds.
- `git` reported my entire user folder (`C:/Users/Yashti`) as a git repository.
- While reading the scanner output, I noticed the same issue being reported more than once (for example, the same token flagged by both Gitleaks and Semgrep).

## How It Was Fixed

- Semgrep checks the internet for updates every time it starts. Setting `SEMGREP_ENABLE_VERSION_CHECK=0` removed the delay.
- Always pass the folder to scan (`python threatlens.py ./test-repo`). This also showed that scanning library folders (venv, `node_modules`) creates noise, which I handled in Stage 4.
- The user-folder repository came from an old accidental `git init` and had no commits. I renamed `.git` to `.git_disabled` (reversible) so git commands behave correctly.
- Duplicate findings happen because each finding's fingerprint includes the tool and rule name, so identical issues from different rules are never merged. I recorded this as an open issue for the team.

## Outcome

ThreatLens runs end to end on my machine, I understand the `Finding` → `SecurityEngine` → report flow that Stage 4 builds on, and the Stage 4 work was broken down into steps:

```text
1. GitHub token        5. Clone the repo
2. Connect to GitHub   6. Scan the clone
3. List repositories   7. Always delete the clone
4. Select repo/branch  8. One CLI command + hand-off to Stage 5
```