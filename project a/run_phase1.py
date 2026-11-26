
# run_phase1.py  –  Phase 1/2/3/4 verification script
#
# PURPOSE:
#   Demonstrates that ThreatLens can:
#     1. Call Gitleaks automatically (Phase 2)
#     2. Parse the JSON output (Phase 3)
#     3. Return structured Finding objects (Phase 4)
#
# HOW TO RUN:
#   python run_phase1.py
#
# EXPECTED OUTPUT:
#   ThreatLens will report the fake secrets in test-repo/
#   Secret values will be REDACTED – never shown in full.


import io
import logging
import json
import sys
import os

# Force UTF-8 output on Windows (fixes emoji/unicode in cp1252 terminals)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Add the project root to Python path so imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scanners.gitleaks_scanner import GitleaksScanner

# Configure logging so we can see what's happening
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
    datefmt="%H:%M:%S",
)

# Path to the controlled test repository 
TEST_REPO_PATH = os.path.join(os.path.dirname(__file__), "test-repo")


def print_separator():
    print("\n" + "=" * 60 + "\n")


def main():
    print_separator()
    print("[THREATLENS]  Phase 1/2/3/4 Verification")
    print(f"   Scanning: {TEST_REPO_PATH}")
    print_separator()

    # Run the scanner
    scanner = GitleaksScanner()

    try:
        findings = scanner.scan(TEST_REPO_PATH)
    except RuntimeError as exc:
        print(f"[ERROR] Scanner error: {exc}")
        sys.exit(1)
    except FileNotFoundError as exc:
        print(f"[ERROR] Path error: {exc}")
        sys.exit(1)

    # Display results 
    if not findings:
        print("[OK] No findings detected.")
        print("   (If you expected findings, check that test-repo has a .git history)")
        return

    print(f"[!] Found {len(findings)} security issue(s):\n")

    for i, finding in enumerate(findings, start=1):
        print(f"{'─' * 60}")
        print(f"Finding #{i}")
        print(f"{'─' * 60}")
        print(f"  Tool:        {finding.tool}")
        print(f"  Rule:        {finding.rule}")
        print(f"  Category:    {finding.category}")
        print(f"  Severity:    {finding.severity}")
        print(f"  File:        {finding.file}")
        print(f"  Line:        {finding.start_line}–{finding.end_line}")
        print()
        print(f"  [?] What is wrong?")
        print(f"     {finding.description}")
        print()
        print(f"  [!] Why is it dangerous?")
        print(f"     {finding.risk}")
        print()
        print(f"  [FIX] Recommended fix:")
        # Indent each line of the multi-line recommendation
        for line in finding.recommendation.split("\n"):
            print(f"     {line}")
        print()
        print(f"  🔑 Fingerprint: {finding.fingerprint}")
        print()

    print_separator()
    print(f"[SUMMARY]")
    print(f"   Total findings: {len(findings)}")

    # Count by severity
    from engine.finding import Severity
    severity_counts = {s: 0 for s in Severity}
    for f in findings:
        severity_counts[f.severity] += 1

    for sev in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]:
        if severity_counts[sev] > 0:
            print(f"   {sev}: {severity_counts[sev]}")

    print_separator()
    print("[OK] Phase 1-4 complete. Gitleaks -> Python -> Finding model works.")
    print()
    print("   NOTE: Actual secret values were REDACTED above.")
    print("   ThreatLens never logs or displays real credentials.")
    print_separator()

    # Also save findings as JSON for inspection
    output_path = os.path.join(os.path.dirname(__file__), "phase1_findings.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump([finding.to_dict() for finding in findings], f, indent=2)
    print(f"   Findings also saved to: {output_path}")


if __name__ == "__main__":
    main()
