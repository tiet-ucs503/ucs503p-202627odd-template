![Tiet Logo](assets/tiet-logo.svg){ .tiet-logo }

**UCS503: Software Engineering (Project)**  
**TIET Patiala**

# ThreatLens: AI-Code Security Platform

**Team:** Vidhi Saxena (1024030700) · Yashti Mittal (1024030701) · Rajat Verma (1024030696)

AI coding assistants make it easy to ship code with leaked keys, outdated packages and injection bugs.
ThreatLens catches all three in one scan by running three security tools and merging what they find:

| Tool | Finds |
|---|---|
| **Gitleaks** | Hardcoded secrets (API keys, tokens, passwords) |
| **OSV-Scanner** | Dependencies with known vulnerabilities |
| **Semgrep** | Insecure code patterns (SQL injection, command injection, unsafe deserialization, …) |

## How it works

1. **Scan.** The three scanners run on a local folder, or on a GitHub repository and branch that ThreatLens clones
   into a temporary folder (and always deletes afterwards).
2. **Merge.** Every result becomes a common `Finding` with a normalised severity (CRITICAL → INFO).
   Exact duplicates are removed, and findings from different tools on the same line are merged into one.
3. **Report.** Results come out as a terminal summary, an HTML report, or JSON.
   If a scanner fails, the report says the scan is **incomplete**. It never claims "clean".

## Where you can use it

- **Command line:** `python threatlens.py <folder>` or `python threatlens.py --github owner/repo [--branch name]`
- **VS Code extension:** findings appear in the Problems panel and a ThreatLens sidebar, with quick fixes
- **Pull requests:** a GitHub Actions workflow scans each PR, posts or updates one summary comment,
  and fails the check when HIGH or CRITICAL issues are found
- **Webhook server:** an optional Flask endpoint that scans PRs on GitHub webhook events

## Project stages

| Stage | What was built |
|---|---|
| 1 | Scanner wrappers for Gitleaks, OSV-Scanner and Semgrep |
| 2 | Unified engine: common finding format, severity normalisation, deduplication |
| 3 | Reports: terminal, HTML and JSON |
| 4 | GitHub integration: token auth, repo/branch selection, secure temporary clones, cleanup |
| 5 | VS Code extension, PR quality gate and webhook server |

## Links

- Source code and setup: [GitHub repository](https://github.com/QuantumWizardz/UCS503P_202627_ThreatLens)
- Weekly journals: see **Journals** in the navigation
