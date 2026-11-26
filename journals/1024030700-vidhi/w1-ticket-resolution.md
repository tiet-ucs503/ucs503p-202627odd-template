# Week 1: Problem Identification, Planning and Initial Research

## 1. Problem Identification

The idea for this problem actually came from something we noticed firsthand. One of our friends had built and deployed a website, and while casually going through it, we opened the browser inspector out of curiosity. We found that some API tokens were exposed right there in the network requests, and using them, it was possible to access other users' data on that platform. This wasn't something we were even looking for; it just turned up during normal use of the site.

That one incident got us thinking about how common this kind of issue might actually be, especially now that a lot of code is being written with the help of AI tools. AI coding tools can generate code quickly, but the generated code may sometimes contain security issues such as hardcoded passwords or API keys, unsafe coding practices, vulnerable dependencies, or improper access control.

We also noticed that there are already different tools available for finding different types of security problems. For example, one tool may detect leaked secrets while another checks dependencies or insecure code patterns. Using different tools separately can make the development process confusing and can also make security issues difficult to track.

Another issue we identified was that security problems are sometimes detected late, after the code has already been pushed, merged, or deployed — much like how our friend's issue was only noticed by chance, after the site was already live.

Based on these observations, we decided to work on an **AI-Code Security Platform** that can help identify security issues in AI-generated code at different stages of the development process.

---

## 2. Idea Selection

After discussing the problem, we finalized the idea of building an **AI-Code Security Platform**--**ThreatLens** .

The main idea is to have security checks at different points in the development workflow instead of checking the code only after it has been completed.

The initial workflow we discussed was:
 **AI Prompt** -> **AI Generated Code** -> **IDE / Editor** -> **GitHub Repository** -> **Scheduled Deep Scan**

To make the workflow more visible and to keep track of the project easily, we divided it into four main modules as follows:

1. **Module 1** – GitHub Repository Scan
2. **Module 2** – IDE / Editor Check
3. **Module 3** – AI Prompt Hardening
4. **Module 4** – Scheduled Deep Scan

The main idea was that to have a common security engine will be used so that the security rules and the format of the findings can be reused by different modules.

---

## 3. Team Discussion and Brainstorming

A meeting was conducted with the team members to discuss the possible functionalities of the project.

During the meeting, we first listed as many possible features as we could think of and then discussed which features were actually useful and feasible to implement.

The main functionalities discussed were:

### Module 1 – GitHub Repository Scan
- Connect the platform with a GitHub repository
- Scan the repository for security issues
- Detect hardcoded passwords, API keys and other secrets
- Check for outdated or vulnerable dependencies
- Detect common unsafe coding patterns
- Generate a security report
- Explain the detected issue in simple language
- Suggest a possible fix
- Post the result directly on the Pull Request

### Module 2 – IDE / Editor Check
- Check newly written or pasted code
- Detect security issues while the developer is coding
- Show warnings inside the editor
- Prevent new security issues from being pushed to GitHub

### Module 3 – Prompt Hardening
- Check the AI coding prompt before the code is generated
- Add security related instructions to the prompt
- Encourage secure coding practices
- Include instructions such as using environment variables and parameterized queries

### Module 4 – Scheduled Deep Scan
- Run deeper security scans periodically
- Find issues that may require more time to analyze
- Identify unused or unnecessary files
- Identify outdated documentation
- Generate a combined report and dashboard

---

## 4. Selecting the Functionalities

After brainstorming, we discussed which functionalities should be included in the project and which ones could be kept for later stages.

One of the main decisions was that the project should not try to implement every feature at the same time.

The four modules were kept as the overall project structure, but the implementation would be done one module at a time.

we decided to start with module one .The first version was therefore planned around this sequence:

**Repository -> Security Scan -> Find Security Issues -> Generate Report -> Suggest Fix -> Show Result on Pull Request**

This also gives us a base on which the other modules can later be connected.

---

## 5. Deciding the First Module

We decided to start with **Module 1 -> Repo Scan and Fix Report**.

The main reason for choosing Module 1 was that it covers the basic security scanning functionality and also gives us an opportunity to build the shared security engine early.

The planned workflow is as follows:

1.GitHub Repository
2.GitHub App / Webhook
3.Security Engine
4.Security Scanners
5.Findings
6.Finding Normalization
7.Deduplication
8.Risk Ranking
9.Plain Language Explanation
10.Fix Recommendation
11.GitHub Pull Request Comment

The first implementation will start with a smaller version of this workflow, and additional scanners/features will be added gradually.

---

## 6. Research on Existing Open-Source Tools

After deciding to start with Module 1, we researched existing open-source tools that could be integrated into our project.

The purpose was to avoid implementing security detection mechanisms completely from scratch when reliable tools already exist.

The tools considered were:
it is represented as **requirement--tool considered**
1.Secret detection -- Gitleaks / TruffleHog
2.Dependency vulnerability detection -- OSV-Scanner
3.Unsafe code pattern detection -- Semgrep
4.GitHub integration -- GitHub App / Webhooks
5.Scan job handling -- Redis-based queue

The idea is to reuse the existing detection capabilities and focus our own development on how these results are combined, ranked and presented to the developer.

---

## 7. Initial Research on Gitleaks

Gitleaks was one of the first tools we started studying.It is useful for detecting possible secrets present in source code or repository history.Some of the types of information we are interested in detecting include:

- API keys
- Passwords
- Access tokens
- Credentials
- Other hardcoded secrets

The basic workflow we understood was:

**Repository --> Gitleaks --> Scan Files --> Detect Possible Secrets --> Return Finding Information**

We also looked at how Gitleaks can provide information about where a possible secret was found.

This is useful for our project because the final report needs to tell the developer which file and line contains the issue.

---

## 8. Understanding How Gitleaks Fits Into Our Project

While researching Gitleaks, we realized that Gitleaks itself should not become the complete security platform.

Instead, it should be one component of our Security Engine.

The planned structure is:

**Security Engine --> Gitleaks --> Gitleaks Output --> Normalizer --> Common Finding Format --> Explanation + Fix**

---

## 9. Initial Module 1 Architecture

Based on the discussions and initial research, we designed the first architecture for Module 1.

```
GitHub Repository
   |
   v
GitHub App / Webhook
   |
   v
Security Engine
   |
   |----> Gitleaks (Secrets)
   |----> OSV (Dependencies)
   |----> Semgrep (Code Patterns)
   |
   v
Finding Normalizer
   |
   v
Deduplication
   |
   v
Risk Ranking
   |
   v
Plain Language Report
   |
   v
Fix Recommendation
   |
   v
GitHub Pull Request Comment
```

The main purpose of the Security Engine is to act as the common layer between the different scanners and the GitHub interface.

---

## 10. Common Finding Format

Another important point identified during the architecture discussion was that different security tools will produce different output formats.

For example:

1. Gitleaks ~ Secret related result
2. OSV ~ Dependency related result
3. Semgrep ~ Code pattern result

If we directly use the output of every tool separately, combining the results later would become difficult.

Therefore, as an initial idea (subject to change once implementation begins), we discussed a possible common format for all findings, with fields such as:

- ID
- Tool
- Type
- Severity
- File
- Line
- Description
- Risk
- Recommendation
- Status

As a rough illustration of what a finding might eventually look like:

> ID: SEC-001
> Tool: Gitleaks
> Type: Secret
> Severity: HIGH
> File: app.py
> Line: 12
> Description: Possible hardcoded API key detected.
> Risk: A credential stored directly in source code may be exposed to anyone who has access to the repository.
> Recommendation: Move the credential to an environment variable.

This is only a proposed structure at this stage — the actual format may be refined once we start working with real Gitleaks output.

---

## 11. Human Approval for Fixes

During the planning stage, we also discussed whether the system should automatically modify the source code when it finds an issue.

We decided that the system should **not** make changes automatically.

Instead, the system should provide a suggested fix and allow the developer to decide whether it should be applied.

The planned workflow is:

**Detect Issue → Explain Issue → Suggest Fix → Developer Reviews → Developer Decides → Fix Applied Manually / With Approval**

The same principle will be used for repository cleanup in the later scheduled scan module.

This avoids situations where the system could make an incorrect change to working code.

---

## 12. Project Proposal and Presentation

After finalizing the problem, project idea, functionalities and initial architecture, we prepared the project proposal.

The proposal covered:

- Higher-order goal
- Time-to-value approach
- Problem statement
- Proposed solution
- Four project modules
- Engineering approach
- Detection methods
- Basic architecture
- Evaluation criteria
- Scalability
- Existing open-source tools
- Project scope
- Deliverables
- Risks and mitigations

The proposal was then presented and discussed.

During this process, the scope of the project became clearer, especially the decision to start implementation with Module 1 rather than trying to develop all four modules together.

---

## 13. Outcome of Week 1

By the end of Week 1, the following work was completed:

- Identified the security problem associated with AI-assisted code generation
- Finalized the idea of an AI-Code Security Platform
- Discussed the problem and idea with the team
- Conducted a brainstorming session for possible functionalities
- Divided the project into four modules
- Decided to start development with Module 1
- Finalized the initial functionality of the GitHub repository scanner
- Prepared the project proposal
- Presented and discussed the proposal
- Researched existing open-source security tools
- Started studying Gitleaks
- Identified OSV-Scanner and Semgrep for additional checks
- Designed the initial architecture of Module 1
- Planned a common format for findings generated by different scanners
- Decided that fixes should require developer approval rather than being applied automatically

---

## 14. Next Week Plan

The next step is to start the actual implementation of Module 1.

The initial plan for the next week is:

1. Set up development environment
2. Install and test Gitleaks
3. Create a small test repository
4. Add sample vulnerable code
5. Run Gitleaks on the repository
6. Understand the generated output
7. Create Python wrapper
8. Convert Gitleaks output into our common finding format
9. Generate a basic security report
