# github_integration/pr_commenter.py
#
# ThreatLens Pull Request Reporter & Security Gate.
# Generates rich Markdown security comments, updates PRs on GitHub,
# populates GitHub Step Summary, and enforces quality gates for CI/CD.

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from github import Github
from github_integration.client import get_github_client, get_token

COMMENT_MARKER = "<!-- threatlens-security-report -->"

SEVERITY_ORDER = {
    "CRITICAL": 5,
    "HIGH": 4,
    "MEDIUM": 3,
    "LOW": 2,
    "INFO": 1,
}

SEVERITY_ICONS = {
    "CRITICAL": "🔴 `CRITICAL`",
    "HIGH": "🟠 `HIGH`",
    "MEDIUM": "🟡 `MEDIUM`",
    "LOW": "🔵 `LOW`",
    "INFO": "ℹ️ `INFO`",
}


def evaluate_quality_gate(scan_data: Dict[str, Any], fail_on: str = "HIGH") -> bool:
    """Check if the scan passes the required security quality gate.

    Args:
        scan_data: The parsed ThreatLens scan JSON dict.
        fail_on: Lowest severity that causes a failure ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE').

    Returns:
        True if the quality gate passed, False if blocking findings exist.
    """
    fail_on = fail_on.upper().strip()
    if fail_on == "NONE":
        return True

    threshold_level = SEVERITY_ORDER.get(fail_on, SEVERITY_ORDER["HIGH"])
    summary = scan_data.get("summary", {})

    for sev_name, sev_level in SEVERITY_ORDER.items():
        if sev_level >= threshold_level and summary.get(sev_name, 0) > 0:
            return False

    return True


def format_pr_comment(scan_data: Dict[str, Any], fail_on: str = "HIGH") -> str:
    """Format a GitHub-flavored Markdown comment summarizing the scan results.

    Args:
        scan_data: Parsed JSON report from ThreatLens.
        fail_on: Severity threshold used for pass/fail decision.

    Returns:
        Markdown string ready for GitHub PR comments.
    """
    summary = scan_data.get("summary", {})
    total = scan_data.get("total", 0)
    passed = evaluate_quality_gate(scan_data, fail_on)

    crit_count = summary.get("CRITICAL", 0)
    high_count = summary.get("HIGH", 0)
    med_count = summary.get("MEDIUM", 0)
    low_count = summary.get("LOW", 0)
    info_count = summary.get("INFO", 0)

    lines: List[str] = [
        COMMENT_MARKER,
        "## 🛡️ ThreatLens AI-Code Security Report",
        "",
    ]

    # Gate status banner
    if passed:
        lines.append("> ### ✅ **Security Quality Gate: PASSED**")
        lines.append(f"> No blocking vulnerabilities found above `{fail_on}` threshold.")
    else:
        blocking_count = sum(summary.get(s, 0) for s in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
                             if SEVERITY_ORDER.get(s, 0) >= SEVERITY_ORDER.get(fail_on, 4))
        lines.append("> ### ❌ **Security Quality Gate: FAILED**")
        lines.append(f"> **{blocking_count} blocking vulnerability(s)** detected (threshold: `{fail_on}`). "
                     "Please review and remediate before merging.")

    lines.append("")

    # Summary metric badges table
    lines.append("| 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🔵 LOW | ℹ️ INFO | Total Findings |")
    lines.append("| :---: | :---: | :---: | :---: | :---: | :---: |")
    lines.append(f"| **{crit_count}** | **{high_count}** | **{med_count}** | **{low_count}** | **{info_count}** | **{total}** |")
    lines.append("")

    # Findings section
    findings = scan_data.get("findings", [])
    if not findings:
        lines.append("### 🎉 Findings")
        lines.append("No security vulnerabilities or leaked secrets were identified in this pull request.")
        lines.append("")
    else:
        lines.append("### 🔍 Security Findings Summary")
        lines.append("")
        lines.append("| Severity | Tool | Location | Rule / Vulnerability | Remediation |")
        lines.append("| :--- | :--- | :--- | :--- | :--- |")

        # Sort findings by severity (highest first)
        sorted_findings = sorted(
            findings,
            key=lambda f: SEVERITY_ORDER.get(str(f.get("severity", "")).upper(), 0),
            reverse=True,
        )

        for f in sorted_findings:
            sev = str(f.get("severity", "INFO")).upper()
            icon = SEVERITY_ICONS.get(sev, sev)
            tool = f.get("tool", "Unknown")
            file_path = f.get("file", "unknown")
            line_no = f.get("line")
            loc = f"`{file_path}:{line_no}`" if line_no else f"`{file_path}`"

            msg = f.get("message", "").replace("\n", " ")
            if len(msg) > 120:
                msg = msg[:117] + "..."

            rule = f.get("rule", "")
            rule_disp = f"**{rule}**<br>{msg}" if rule else msg

            fix = f.get("fix", "")
            if fix:
                fix_snippet = fix.replace("\n", " ")
                if len(fix_snippet) > 100:
                    fix_snippet = fix_snippet[:97] + "..."
                rem = f"<details><summary>Fix Suggestion</summary>{fix_snippet}</details>"
            else:
                rem = "—"

            lines.append(f"| {icon} | `{tool}` | {loc} | {rule_disp} | {rem} |")

        lines.append("")

    # Scanner status table
    scanners = scan_data.get("scanners", [])
    if scanners:
        lines.append("<details>")
        lines.append("<summary><b>⚙️ Scanner Execution Status</b></summary><br>")
        lines.append("")
        lines.append("| Scanner | Status | Details |")
        lines.append("| :--- | :---: | :--- |")
        for s in scanners:
            name = s.get("name", "Unknown")
            ok = s.get("ok", False)
            status_str = "✅ Passed" if ok else "❌ Failed"
            err = s.get("error") or "Completed successfully"
            lines.append(f"| **{name}** | {status_str} | {err} |")
        lines.append("</details>")
        lines.append("")

    lines.append("---")
    lines.append("*Automated security gate powered by **ThreatLens** AI-Code Security Platform.*")
    return "\n".join(lines)


def post_or_update_pr_comment(
    repo_name: str,
    pr_number: int,
    comment_body: str,
    gh: Optional[Github] = None,
    token: Optional[str] = None,
) -> bool:
    """Find existing ThreatLens sticky comment on the PR and update it, or post a new one.

    Args:
        repo_name: 'owner/repo'
        pr_number: Pull request integer number
        comment_body: Formatted Markdown text
        gh: Optional Github client
        token: Optional auth token

    Returns:
        True if comment was created or updated successfully.
    """
    if gh is None:
        if token is None:
            token = get_token()
        gh = get_github_client()

    repo = gh.get_repo(repo_name)
    pull = repo.get_pull(pr_number)

    # Search existing comments for our signature marker
    existing_comment = None
    for comment in pull.get_issue_comments():
        if COMMENT_MARKER in (comment.body or ""):
            existing_comment = comment
            break

    if existing_comment:
        existing_comment.edit(comment_body)
        print(f"[ThreatLens] Updated existing security comment on PR #{pr_number}")
    else:
        pull.create_issue_comment(comment_body)
        print(f"[ThreatLens] Created new security comment on PR #{pr_number}")

    return True


def write_step_summary(comment_body: str, summary_file: Optional[str] = None) -> None:
    """Write the comment body to GitHub Step Summary if available."""
    target_path = summary_file or os.getenv("GITHUB_STEP_SUMMARY")
    if not target_path:
        return

    try:
        with open(target_path, "a", encoding="utf-8") as f:
            f.write(comment_body + "\n\n")
        print(f"[ThreatLens] Appended security summary to {target_path}")
    except Exception as exc:
        print(f"[ThreatLens Warning] Failed to write step summary: {exc}", file=sys.stderr)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="ThreatLens Pull Request Commenter and Quality Gate")
    parser.add_argument("report", help="Path to ThreatLens JSON report file (or '-' for stdin)")
    parser.add_argument("--repo", help="Target GitHub repository ('owner/repo')", default=os.getenv("GITHUB_REPOSITORY"))
    parser.add_argument("--pr", type=int, help="Pull request number", default=None)
    parser.add_argument("--token", help="GitHub authentication token", default=None)
    parser.add_argument("--fail-on", choices=["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"],
                        default="HIGH", help="Severity threshold that triggers non-zero exit code (default: HIGH)")
    parser.add_argument("--output-markdown", help="Save generated markdown to this file path", default=None)

    args = parser.parse_args(argv)

    # Read scan data
    if args.report == "-":
        content = sys.stdin.read()
    else:
        report_path = Path(args.report)
        if not report_path.exists():
            print(f"[ThreatLens Error] Report file not found: {args.report}", file=sys.stderr)
            return 2
        content = report_path.read_text(encoding="utf-8")

    try:
        scan_data = json.loads(content)
    except json.JSONDecodeError as exc:
        print(f"[ThreatLens Error] Failed to parse JSON report: {exc}", file=sys.stderr)
        return 2

    markdown_comment = format_pr_comment(scan_data, fail_on=args.fail_on)

    # Write to file if requested
    if args.output_markdown:
        Path(args.output_markdown).write_text(markdown_comment, encoding="utf-8")
        print(f"[ThreatLens] Markdown report saved to {args.output_markdown}")

    # Write to GITHUB_STEP_SUMMARY if running in GitHub Actions
    write_step_summary(markdown_comment)

    # Post or update PR comment if repo and PR are given
    if args.repo and args.pr:
        try:
            post_or_update_pr_comment(
                repo_name=args.repo,
                pr_number=args.pr,
                comment_body=markdown_comment,
                token=args.token,
            )
        except Exception as exc:
            print(f"[ThreatLens Error] Failed to comment on PR #{args.pr}: {exc}", file=sys.stderr)
            # We don't fail the gate purely on comment failure, unless intended

    passed = evaluate_quality_gate(scan_data, fail_on=args.fail_on)
    if not passed:
        print(f"[ThreatLens] Quality gate FAILED: vulnerabilities meeting or exceeding '{args.fail_on}' exist.")
        return 1

    print(f"[ThreatLens] Quality gate PASSED: no issues meeting or exceeding '{args.fail_on}'.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
