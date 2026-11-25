# ThreatLens: Unified AI-Code Security Platform

ThreatLens is an intelligent, multi-engine security scanning platform designed for modern software repositories. It consolidates three specialized security scanners into a single, unified pipeline with two-tier deduplication, risk scoring, automated remediation advice, VS Code IDE integration, and GitHub Actions PR quality gates.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ThreatLens Pipeline                           │
├───────────────────┬───────────────────┬────────────────────────────────┤
│     Gitleaks      │    OSV-Scanner    │            Semgrep             │
│ (Hardcoded Secret │  (Vulnerable Deps │   (Insecure Code Patterns /    │
│    Detection)     │    & Licences)    │         OWASP SAST)            │
└─────────┬─────────┴─────────┬─────────┴────────────────┬───────────────┘
          │                   │                          │
          └───────────────────┼──────────────────────────┘
                              ▼
        ┌───────────────────────────────────────────────┐
        │        ThreatLens Unified Engine Core         │
        │   • Cross-Scanner Severity Resolution         │
        │   • Multi-Rule Same-Line Consolidation        │
        │   • Deterministic Fingerprint Deduplication   │
        └──────────────────────┬────────────────────────┘
                               ▼
     ┌─────────────────────────┼─────────────────────────┐
     ▼                         ▼                         ▼
┌──────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ HTML Report  │      │  JSON Contract  │      │ GitHub Actions  │
│ & Terminal   │      │ (VS Code Ext /  │      │  CI/CD Gate &   │
│  Dashboards  │      │   Webhooks)     │      │   PR Comments   │
└──────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 🚀 Key Features

1. **Triple-Scanner Fusion**:
   - **Gitleaks**: High-entropy token, secret, and credential detection.
   - **OSV-Scanner**: Open Source Vulnerabilities scanner inspecting dependency manifests (`requirements.txt`, `package.json`, etc.).
   - **Semgrep**: Fast, semantic static analysis covering OWASP Top 10 vulnerabilities (SQLi, XSS, Path Traversal, SSRF, Insecure Deserialization).

2. **Advanced Deduplication & Severity Normalization**:
   - Consolidates redundant alerts on the same line into a unified composite finding.
   - Retains the highest severity and unifies remediation instructions across all matched rules.

3. **VS Code Extension (ThreatLens - AI Code Security)**:
   - Native editor sidebar tree view of security findings categorized by severity.
   - Interactive Problems panel diagnostics with direct code highlighting.
   - Lightbulb Quick-Fix actions with one-click automated remediation.
   - Status bar trigger and command palette integrations.

4. **GitHub PR Security Gate & CI/CD**:
   - GitHub Actions workflow (`.github/workflows/threatlens.yml`) running on PRs and pushes.
   - Automated sticky PR comments displaying formatted summary metrics and collapsible finding cards.
   - Configurable Quality Gate (`fail_on` parameter) blocking vulnerable PR merges.
   - Webhook server (`webhook_server.py`) for automated event-driven scans.

---

## 🛠️ Installation & Setup

### 1. Python Environment
```bash
cd "project a"
python -m venv .venv
source .venv/bin/activate       # macOS / Linux
# or: .venv\Scripts\activate   # Windows

pip install -r requirements.txt
```

### 2. External Scanner Binaries
- **Gitleaks**: `brew install gitleaks` (macOS) or download from [GitHub Releases](https://github.com/gitleaks/gitleaks/releases).
- **OSV-Scanner**: `brew install osv-scanner` (macOS) or download from [GitHub Releases](https://github.com/google/osv-scanner/releases).
- **Semgrep**: Included in `requirements.txt` (`pip install semgrep`).

### 3. Environment Configuration
Create a `.env` file in `project a/`:
```env
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## 💻 CLI Usage

### Local Folder Scan
```bash
# Scan a folder and open interactive HTML report
python threatlens.py ./path-to-code

# Produce machine-readable JSON output (VS Code extension / CI contract)
python threatlens.py ./path-to-code --json --no-open
```

### Remote GitHub Repository Scan
```bash
# Interactive branch picker
python threatlens.py --github owner/repo

# Scan specific branch directly
python threatlens.py --github owner/repo --branch main

# List branches of a repository
python threatlens.py branches owner/repo
```

### Exit Codes
- `0`: Scan completed cleanly with no CRITICAL or HIGH findings.
- `1`: Scan completed and found CRITICAL or HIGH security issues.
- `2`: Fatal error (invalid credentials, repository not found, git error).

---

## 🤖 GitHub Actions CI/CD & PR Commenting

The repository includes a ready-to-run GitHub Actions workflow located at:
[`.github/workflows/threatlens.yml`](../.github/workflows/threatlens.yml)

### Workflow Highlights
- Provisions all 3 scanners on Ubuntu runners.
- Executes `threatlens.py` against the repository diff.
- Runs `github_integration.pr_commenter` to update the PR comment with an interactive security breakdown.
- Fails the job if findings match or exceed the configured `--fail-on` threshold (default: `HIGH`).
- Publishes HTML and JSON scan artifacts for download.

### Webhook Server
For standalone server deployments receiving GitHub webhook notifications:
```bash
python -m github_integration.webhook_server
```
Endpoints:
- `GET /health`: Health check status.
- `POST /webhook`: GitHub webhook endpoint with HMAC-SHA256 signature verification.

---

## 🧪 Test Suite

Run all unit and integration tests:
```bash
pytest tests/ -v
```

All 19 test cases validate:
- Cross-scanner secret consolidation.
- Multi-rule Semgrep same-line consolidation.
- Fingerprint stability and JSON schema contract adherence.
- PR commenter Markdown formatting and quality gate evaluation.
- Webhook signature verification and pull request event workflows.
