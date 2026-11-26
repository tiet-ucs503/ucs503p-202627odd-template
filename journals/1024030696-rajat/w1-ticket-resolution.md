# Week 1: Problem Identification, System Architecture & Scanner Research

**Author**: Rajat (1024030696)  
**Collaborators**: Vidhi (1024030700), Yashti (1024030701)  
**Date**: August 2026

---

## 1. Problem Identification & Motivation

Our team initiated this project after observing a critical vulnerability pattern in modern web deployments. While inspecting a student project web application using browser developer tools, we noticed sensitive API access tokens directly exposed in frontend network requests. Using those credentials, unauthorized data from other accounts could be queried. 

This made us investigate how widespread such vulnerabilities are, especially with the rapid adoption of AI coding assistants (ChatGPT, GitHub Copilot, Claude). While AI tools accelerate coding speed, they frequently output insecure patterns:
1. Hardcoded API tokens, database connection URIs, and private keys.
2. Insecure coding patterns: raw SQL string concatenation, unsanitized user input in filesystem calls (Path Traversal), and disabled SSL/TLS certificate verification.
3. Outdated or compromised third-party package dependencies containing known CVEs.

Most existing security tools specialize in only one aspect (e.g., Gitleaks for secrets, Bandit or Semgrep for static code analysis, Dependabot for dependencies). Developers face significant cognitive friction switching between disconnected tools. Furthermore, security checks usually occur late in the deployment cycle rather than during active development.

To solve this, we set out to build **ThreatLens** — an AI-Code Security Platform that unifies secrets detection, vulnerable dependencies, and static semantic code analysis across the development workflow.

---

## 2. Team Brainstorming & Architecture Definition

In our initial design meetings, Vidhi, Yashti, and I mapped out the overall platform architecture. We envisioned a four-stage workflow:

```
[ AI Prompt ] ──► [ AI Code ] ──► [ IDE / Editor ] ──► [ GitHub PR ] ──► [ Scheduled Deep Scan ]
```

To ensure maintainability, we decomposed the platform into four distinct modules:
- **Module 1 – Repository Security Engine & Report Generator**: Core multi-scanner pipeline scanning repositories, normalizing findings, and outputting actionable reports.
- **Module 2 – IDE / Editor Integration (VS Code)**: Real-time editor diagnostics, Problems panel integration, and one-click quick fixes.
- **Module 3 – AI Prompt Security Hardening**: Sanitizing and enriching prompts with security guardrails.
- **Module 4 – Scheduled Deep Scan & Audit Dashboard**: Long-running background repository audits.

We unanimously agreed that **Module 1 (Repository Security Scan)** was the critical foundation upon which the remaining modules would depend.

---

## 3. Individual Research & Scanner Evaluation

My primary focus during Week 1 was evaluating static application security testing (SAST) and software composition analysis (SCA) tools to complement our secrets detection:

### A. Semgrep (Semantic Static Analysis)
- I researched Semgrep's rule syntax and performance characteristics. Unlike purely regex-based linters (like Flake8), Semgrep understands abstract syntax trees (ASTs), which drastically reduces false positives for patterns such as:
  - SQL injection (`python.flask.security.audit.formatted-sql-query`)
  - Path traversal (`javascript.lang.security.audit.path-traversal`)
  - Command injection (`subprocess` with `shell=True`)
- I identified key OWASP Top 10 rulesets that directly apply to AI-generated Python and TypeScript code.

### B. OSV-Scanner (Open Source Vulnerability Scanner)
- I analyzed Google's OSV-Scanner for identifying known vulnerabilities in dependencies (`requirements.txt`, `package.json`, `go.mod`).
- Key observation: OSV queries the distributed Open Source Vulnerabilities database without requiring heavy local vulnerability databases, making it fast and lightweight for CI/CD.

### C. Standard Finding Schema
- I drafted the common finding schema that connects all three scanners into a unified interface:
  ```python
  @dataclass
  class Finding:
      file: str
      start_line: int
      start_column: int
      end_line: int
      end_column: int
      severity: Severity
      category: str
      tool: str
      rule: str
      description: str
      risk: str
      recommendation: str
      reference: str
      fingerprint: str
  ```

---

## 4. Collaborative Contributions

- **Collaboration with Vidhi**: Vidhi spearheaded the Gitleaks investigation and secret pattern research. I assisted in testing Gitleaks CLI flags against Git commit histories and comparing its output format with Semgrep's JSON schema.
- **Collaboration with Yashti**: Yashti focused on dependency manifest discovery and pipeline structure. I helped her verify how OSV-Scanner handles missing line numbers (since package vulnerabilities apply to the entire manifest file rather than a specific line).

---

## 5. Summary & Next Steps

At the end of Week 1, we successfully defined the project scope, validated our choice of open-source tools (Gitleaks, OSV-Scanner, Semgrep), and established our unified `Finding` data contract. Next, we will begin implementing the core Python engine and scanner wrappers in Module 1.
