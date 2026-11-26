# Week 5: CI/CD GitHub Actions PR Security Gate, Webhook Server & Test Suite

**Author**: Rajat (1024030696)  
**Collaborators**: Vidhi (1024030700), Yashti (1024030701)  
**Date**: October 2026

---

## 1. Objectives & Overview

In Week 5, we connected all components into an automated CI/CD pipeline:
1. **GitHub Actions PR Quality Gate**: Automatically running ThreatLens whenever a pull request is opened or updated, blocking merge if critical or high vulnerabilities are present.
2. **Sticky PR Commenter**: Generating clear Markdown reports and posting/updating a single comment thread on the Pull Request.
3. **Webhook Receiver**: A standalone server to receive GitHub webhook events and trigger automated scans.
4. **End-to-End Test Suite**: Bringing all modules under unit and integration test coverage.

---

## 2. Key Contributions

### A. GitHub Actions Workflow (`.github/workflows/threatlens.yml`)
- Designed and authored the GitHub Actions CI workflow:
  - **Triggers**: Pull requests targeting `main`/`master`, direct pushes, and manual `workflow_dispatch` with custom severity inputs.
  - **Scanner Provisioning**: Automated installation of Gitleaks (v8.18.4) and OSV-Scanner (v2.7.0) Linux binaries directly onto the Ubuntu runner, with Semgrep installed via pip.
  - **Scan Execution**: Runs `threatlens.py` against the repository diff, producing `threatlens_report.json` and HTML reports.
  - **Artifact Retention**: Automatically uploads scan reports as GitHub Action artifacts with 14-day retention.
  - **Quality Gate Enforcement**: Evaluates findings against the `--fail-on` threshold, terminating with exit code 1 if blocking issues exist.

### B. Pull Request Reporter & Sticky Commenting (`github_integration/pr_commenter.py`)
- Created `pr_commenter.py` using PyGithub:
  - **Sticky Commenting**: To avoid comment spam on every push to a PR, the script scans existing issue comments for a hidden HTML marker (`<!-- threatlens-security-report -->`). If found, it updates the existing comment in-place; otherwise, it creates a new one.
  - **Summary Metrics**: Formats metric badge tables (Critical, High, Medium, Low, Info) and collapsible finding details with direct rule and remediation links.
  - **Native Step Summary**: Automatically appends the Markdown report to `$GITHUB_STEP_SUMMARY` so developers can inspect the scan summary directly in the GitHub Actions run overview.

### C. Webhook Receiver Server (`github_integration/webhook_server.py`)
- Built an event-driven webhook receiver using Flask:
  - **HMAC SHA-256 Verification**: Computes and verifies the `X-Hub-Signature-256` header against `GITHUB_WEBHOOK_SECRET` using `hmac.compare_digest` to prevent unauthorized payload forgery.
  - **PR Event Handling**: Filters for `pull_request` actions (`opened`, `synchronize`, `reopened`), triggers `scan_github_repo()`, and automatically posts the security analysis back to the PR.
  - Added a `/health` endpoint for uptime monitoring.

### D. Test Automation & Encoding Bug Fix
- **Resolving TOML BOM Encoding**: Discovered that `pyproject.toml` had an unexpected UTF-8 Byte Order Mark (`\xef\xbb\xbf`) at the beginning of the file, which caused pytest 8's `tomllib` parser to fail with an `Invalid statement` error. I stripped the BOM to make the file compliant with TOML standards.
- **Comprehensive Test Suite (`tests/test_pr_integration.py`)**:
  - Implemented unit tests for quality gate pass/fail thresholds.
  - Added tests for comment Markdown formatting, comment creation vs update, HMAC signature verification, and mock webhook PR handling.
  - Verified full test suite across the project: **all 19 tests passing**.

---

## 3. Team Collaboration

- **Collaborating with Vidhi**: Vidhi assisted in testing the PR commenting flow with different GitHub Personal Access Token permissions and validating the webhook JSON payloads.
- **Collaborating with Yashti**: Yashti and I reviewed the Markdown report formatting to ensure readability on both GitHub dark and light themes, and verified that HTML reports were properly archived as artifacts.
- **Branch Management**: Staged and committed all work on our dedicated branch `stage5-extension-pr-automation` with clean, structured commit messages and pushed upstream.

---

## 4. Key Learnings & Outcome

- **End-to-End Shift-Left Security**: With Module 1 (CLI), Module 2 (VS Code Extension), and Module 5 (GitHub Actions & Webhooks) fully connected, ThreatLens provides seamless security feedback across every layer of the developer workflow.
- **Continuous Verification**: Having an automated test suite gave us the confidence to refactor path resolution and deduplication logic without regression.
