# threatlens.py
#
# The main CLI entry point for ThreatLens.
#
# Scan a folder on this computer:
#   python threatlens.py ./path-to-repository
#
# Scan a GitHub repository (Stage 4):
#   python threatlens.py --github owner/repo                 -> asks which branch
#   python threatlens.py --github owner/repo --branch dev    -> no question
#
# List the branches of a GitHub repository:
#   python threatlens.py branches owner/repo
#
# Output options:
#   --json      print ONE JSON object to stdout (for the VS Code extension)
#   --text      print the old full text report instead of writing HTML
#   --no-open   write the HTML report but don't open the browser
#
# Exit codes (so scripts / CI / the extension can react):
#   0 = scan OK, no HIGH or CRITICAL issues
#   1 = scan OK, HIGH or CRITICAL issues found
#   2 = could not run (bad token, repo not found, clone failed, bad arguments)
#
# Token: read from the GITHUB_TOKEN environment variable, or from .env.
# The VS Code extension passes the user's VS Code GitHub login this way.

import argparse
import io
import os
import sys
from pathlib import Path

# UTF-8 output on Windows terminals; line_buffering keeps prints in order.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace",
                              line_buffering=True)

from engine.finding import Severity
from engine.security_engine import ScanReport, SecurityEngine
from reporting import json_report
from reporting.html_report import write_html_report
from reporting.report_generator import ReportGenerator
from scanners.gitleaks_scanner import GitleaksScanner
from scanners.osv_scanner import OsvScanner
from scanners.semgrep_scanner import SemgrepScanner

REPORTS_DIR = Path(__file__).resolve().parent / "reports"

EXIT_OK = 0
EXIT_ISSUES_FOUND = 1
EXIT_ERROR = 2


# ── Helpers ──────────────────────────────────────────────────

class Output:
    """Decides where messages go.

    In --json mode, stdout must contain ONLY the JSON object - otherwise
    the extension's JSON.parse() fails. So progress messages go to
    stderr instead (the extension can show or ignore them).
    """

    def __init__(self, json_mode: bool):
        self.json_mode = json_mode

    def say(self, message: str) -> None:
        print(message, file=sys.stderr if self.json_mode else sys.stdout, flush=True)

    def result(self, data: dict) -> None:
        print(json_report.dumps(data))

    def fail(self, err: Exception | str, error_type: str | None = None) -> int:
        message = str(err)
        if self.json_mode:
            kind = error_type or (type(err).__name__ if isinstance(err, Exception) else "error")
            self.result(json_report.error_json(message, kind))
        else:
            print(f" [FAILED] {message}")
        return EXIT_ERROR


def exit_code_for(report: ScanReport) -> int:
    """1 if anything HIGH or CRITICAL was found, else 0."""
    serious = report.has_severity(Severity.CRITICAL) or report.has_severity(Severity.HIGH)
    return EXIT_ISSUES_FOUND if serious else EXIT_OK


def print_short_summary(report: ScanReport, html_path: Path) -> None:
    """A few lines in the terminal; the details live in the HTML file."""
    print("\n" + "=" * 60)
    print(" ThreatLens scan complete")
    print("=" * 60)
    print(f" Total issues : {report.total}")
    for sev in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]:
        count = report.summary.get(str(sev), 0)
        if count:
            print(f"   {str(sev):<9}: {count}")
    for r in report.failed_scanners:
        print(f" [!] {r.scanner_name} FAILED - results are incomplete")
    print(f"\n Full report  : {html_path}")
    print(" (Open it in a browser. Ctrl+P -> 'Save as PDF' to get a PDF.)")
    print("=" * 60)


def output_report(report: ScanReport, args, out: Output, name: str,
                  details: dict | None = None) -> None:
    """Show the report the way the user asked: --json, --text or HTML."""
    if args.json:
        json_details = {k.lower(): v for k, v in (details or {}).items()}
        out.result(json_report.build_json(report, json_details))
    elif args.text:
        print("\n" + ReportGenerator().generate_text_report(report))
    else:
        html_path = write_html_report(report, output_dir=REPORTS_DIR, name=name,
                                      details=details, open_in_browser=not args.no_open)
        print_short_summary(report, html_path)


# ── Mode 1: local folder ─────────────────────────────────────

def run_local_scan(args, out: Output) -> int:
    repo_path = os.path.abspath(args.repo_path)
    if not os.path.isdir(repo_path):
        return out.fail(f"Directory not found: {repo_path}", "NotFound")

    out.say(f" Starting ThreatLens scan on: {repo_path}")
    out.say(" Running scanners (Gitleaks, OSV-Scanner, Semgrep)... Please wait.")

    report = (
        SecurityEngine(repo_path=repo_path)
        .add_scanner("Gitleaks", GitleaksScanner())
        .add_scanner("OSV-Scanner", OsvScanner())
        .add_scanner("Semgrep", SemgrepScanner())
    ).scan()

    output_report(report, args, out, name=Path(repo_path).name)
    return exit_code_for(report)


# ── Mode 2: GitHub repository ────────────────────────────────

def run_github_scan(args, out: Output) -> int:
    # Imported here so local scans work even without PyGithub / a token.
    from github_integration.branches import BranchError, list_branches, prompt_for_branch
    from github_integration.client import get_github_client, verify_connection
    from github_integration.pipeline import GITHUB_SCAN_ERRORS, scan_github_repo
    from github_integration.repo_selector import select_repo

    try:
        gh = get_github_client()
        user = verify_connection(gh)
        out.say(f" Connected to GitHub as {user}")

        branch = args.branch
        # Only show the menu if a human is typing AND we're not in --json mode.
        if branch is None and sys.stdin.isatty() and not args.json:
            info = select_repo(gh, args.github)
            branches = list_branches(gh, info)
            if len(branches) > 1:
                branch = prompt_for_branch(branches, info.default_branch)

        out.say(f" Cloning and scanning {args.github} "
                f"(branch: {branch or 'default'})... Semgrep can take a minute.")
        result = scan_github_repo(args.github, branch=branch, gh=gh)

    except (*GITHUB_SCAN_ERRORS, BranchError) as err:
        return out.fail(err)
    except KeyboardInterrupt:
        return out.fail("Cancelled. (Any temporary clone was deleted.)", "Cancelled")

    if result.skipped_dirs:
        out.say(f" Skipped {len(result.skipped_dirs)} junk folder(s) "
                f"(installed libraries / caches).")

    output_report(
        result.report, args, out,
        name=result.repo.full_name.replace("/", "_"),
        details={
            "Repository": result.repo.full_name,
            "Branch": result.branch,
            "Commit": result.commit_sha if args.json else result.short_sha,
        },
    )
    return exit_code_for(result.report)


# ── Mode 3: list branches ────────────────────────────────────

def run_branches(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="threatlens.py branches",
        description="List the branches of a GitHub repository",
    )
    parser.add_argument("repo", metavar="OWNER/REPO")
    parser.add_argument("--json", action="store_true", help="print JSON (for the VS Code extension)")
    args = parser.parse_args(argv)
    out = Output(args.json)

    from github_integration.branches import BranchError, list_branches
    from github_integration.client import GitHubAuthError, get_github_client, verify_connection
    from github_integration.repo_selector import RepoSelectionError, select_repo

    try:
        gh = get_github_client()
        verify_connection(gh)
        info = select_repo(gh, args.repo)
        branches = list_branches(gh, info)
    except (GitHubAuthError, RepoSelectionError, BranchError) as err:
        return out.fail(err)

    if args.json:
        out.result({
            "schema_version": json_report.SCHEMA_VERSION,
            "status": "ok",
            "repository": info.full_name,
            "default_branch": info.default_branch,
            "branches": branches,          # default branch first, then A-Z
        })
    else:
        print(f"{info.full_name} has {len(branches)} branch(es):")
        for name in branches:
            print(f"  - {name}{'  (default)' if name == info.default_branch else ''}")
    return EXIT_OK


# ── Entry point ──────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv

    # "branches" is a separate command with its own arguments.
    if argv and argv[0] == "branches":
        return run_branches(argv[1:])

    parser = argparse.ArgumentParser(description="ThreatLens - AI-Powered Code Security Platform")
    parser.add_argument("repo_path", nargs="?", default=".",
                        help="Local folder to scan (default: current directory)")
    parser.add_argument("--github", metavar="OWNER/REPO",
                        help="Scan a GitHub repository instead of a local folder")
    parser.add_argument("--branch", metavar="NAME",
                        help="Branch to scan with --github (default: ask, or the default branch)")
    output_group = parser.add_mutually_exclusive_group()
    output_group.add_argument("--json", action="store_true",
                              help="Print one JSON object to stdout (for the VS Code extension)")
    output_group.add_argument("--text", action="store_true",
                              help="Print the full text report in the terminal instead of writing HTML")
    parser.add_argument("--no-open", action="store_true",
                        help="Write the HTML report but don't open the browser")
    args = parser.parse_args(argv)

    if args.branch and not args.github:
        parser.error("--branch only works together with --github")

    out = Output(args.json)
    return run_github_scan(args, out) if args.github else run_local_scan(args, out)


if __name__ == "__main__":
    sys.exit(main())