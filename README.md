# ThreatLens: AI-Code Security Platform

**UCS503P Software Engineering Project, TIET Patiala (2026–27 ODD)**
Team: Vidhi Saxena (1024030700) · Yashti Mittal (1024030701) · Rajat Verma (1024030696)

ThreatLens scans a codebase with three security tools at once and merges their results into a single report:

| Tool | What it finds |
|---|---|
| **Gitleaks** | Hardcoded secrets: API keys, tokens, passwords |
| **OSV-Scanner** | Dependencies with known vulnerabilities (`requirements.txt`, `package-lock.json`, …) |
| **Semgrep** | Insecure code patterns: SQL injection, command injection, unsafe deserialization, … |

The engine normalises severities, merges duplicate findings, and outputs a terminal summary, an HTML report, or JSON.
On top of the engine you can:

- **Scan any GitHub repo or branch** without cloning it yourself (`--github owner/repo`)
- **Use it in VS Code**: findings show up in the Problems panel, a sidebar tree, and quick fixes
- **Gate pull requests**: a GitHub Actions workflow scans each PR, posts a summary comment, and fails on HIGH/CRITICAL issues

## Quick start

```bash
cd "project a"
python -m venv .venv
.venv\Scripts\activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt   # includes Semgrep
# Install Gitleaks and OSV-Scanner from their GitHub releases (or put the .exe next to threatlens.py)

python threatlens.py ./some-project               # scan a folder, opens the HTML report
python threatlens.py --github owner/repo          # scan a GitHub repo (needs GITHUB_TOKEN in .env)
python threatlens.py ./some-project --json        # JSON for tools/CI
```

Exit codes: `0` clean, `1` HIGH/CRITICAL found, `2` couldn't complete (including "a scanner failed").

Full CLI, CI and webhook documentation: [`project a/README.md`](project%20a/README.md).

## Repository layout

| Path | Contents |
|---|---|
| `project a/` | The ThreatLens engine, CLI, scanners, reports, GitHub integration and tests |
| `project a/test-repo/` | A **deliberately vulnerable** demo project (fake secrets, old packages) to scan |
| `vscode-extension/` | The VS Code extension (TypeScript source in `src/`, compiled in `out/`) |
| `.github/workflows/threatlens.yml` | PR security gate |
| `journals/` | Weekly journals, one folder per team member |
| `project-proposal/`, `project-report-prototype-stage/`, `project-report-final/` | Course reports (LaTeX) |
| `docs/` | Documentation site (built with MkDocs on every push to `master`) |

## Tests

```bash
cd "project a"
python -m pytest -q
```

## Docs site

Every push to `master` builds `docs/` (including the journals) with MkDocs and publishes it to GitHub Pages.
To preview locally: `pip install mkdocs-material mkdocs-literate-nav mkdocs-section-index mkdocs-git-authors-plugin mkdocs-git-revision-date-localized-plugin mkdocstrings-python` then `mkdocs serve`.

*Built on the UCS503P project template by Raghav B. Venkataramaiyer.*
