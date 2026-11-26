# Week 1: Problem Identification, Planning and Work Division

**Focus:** Understanding the problem, choosing the tools, and planning ThreatLens with the team (Rajat, Vidhi, Yashti).

## 1. Problem Identification

While looking at a friend's deployed website through the browser inspector, we found API tokens exposed in the network requests, and they could be used to access other users' data. This made us look at how often such issues appear, especially now that much code is written with AI tools, which can produce:

- hardcoded passwords and API keys
- unsafe code patterns (SQL injection, shell injection)
- outdated libraries with known vulnerabilities

Different tools already exist for each kind of problem, but developers have to run them separately, the outputs are hard to understand, and issues are often found only after the code is merged or deployed.

## 2. Idea: ThreatLens

We decided to build **ThreatLens**, an AI-Code Security Platform with four modules:

1. **Module 1** – GitHub repository scan and fix report
2. **Module 2** – IDE / editor check (VS Code)
3. **Module 3** – AI prompt hardening
4. **Module 4** – scheduled deep scan

Module 1 is the foundation the other modules depend on, so we started there.

## 3. Choosing the Scanners

| Tool | Finds |
|---|---|
| **Gitleaks** | leaked secrets (API keys, tokens, passwords) |
| **OSV-Scanner** | libraries/packages with known vulnerabilities (CVEs) |
| **Semgrep** | insecure code patterns |

The main problem is that each tool gives its output in a different format, so ThreatLens needs one common format for all findings.

## 4. The Plan: 5 Stages, 19 Phases

```text
Stage 1 – Local scanning working        Phase 0  Install tools, check versions
                                        Phase 1  Manually test Gitleaks
                                        Phase 2  Run Gitleaks from Python
                                        Phase 3  Python understands Gitleaks output

Stage 2 – Add all 3 scanners            Phase 4  One common Finding model
                                        Phase 5  Security engine
                                        Phase 6  Add OSV-Scanner
                                        Phase 7  Add Semgrep
                                        Phase 8  Normalise / remove duplicates
                                        Phase 9  Decide severity

Stage 3 – Understand + report           Phase 10 Explain the problem
                                        Phase 11 Generate report
                                        Phase 12 Test everything locally

Stage 4 – Connect ThreatLens to GitHub  Phase 13 Connect to GitHub
                                        Phase 14 Select repository
                                        Phase 15 Scan GitHub repository

Stage 5 – Automatic scanning            VS Code extension, findings in the Problems
                                        panel, PR/push scanning and comments
```

Planned engine flow:

```text
security_engine.py -> run Gitleaks -> run OSV -> run Semgrep
                   -> collect everything -> remove duplicates -> sort by severity
```

Planned package layout:

```text
engine/      finding.py (common Finding format), security_engine.py
scanners/    one wrapper per tool
reporting/   report generation
github/      Stages 4 and 5
tests/       test code
test-repo/   fake API key, vulnerable dependency, insecure code
```

## 5. Work Division

| Stages | Owner |
|---|---|
| Stages 1–3 (local scanning, engine, reports) | Vidhi |
| **Stage 4 (GitHub integration)** | **Yashti** |
| Stage 5 (VS Code extension, PR automation) | Rajat |

## Outcome

The team agreed on the problem, the three scanners, the 19-phase plan and the module structure, and each member took ownership of specific stages. My stage is Stage 4: connecting ThreatLens to GitHub.