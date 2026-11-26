
# run_stage2.py – Stage 2 complete verification
#
# Runs ALL THREE scanners through the SecurityEngine and
# demonstrates the full multi-scanner pipeline:
#
#   Gitleaks   → secrets
#   OSV-Scanner → vulnerable dependencies
#   Semgrep     → insecure code patterns
#
# Run: python run_stage2.py

import io
import logging
import sys
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine.security_engine import SecurityEngine
from engine.finding import Severity
from scanners.gitleaks_scanner import GitleaksScanner
from scanners.osv_scanner import OsvScanner
from scanners.semgrep_scanner import SemgrepScanner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%H:%M:%S",
)

TEST_REPO = os.path.join(os.path.dirname(__file__), "test-repo")
SEP  = "=" * 60
SEP2 = "-" * 60

SEVERITY_LABEL = {
    Severity.CRITICAL: "[CRITICAL]",
    Severity.HIGH:     "[HIGH]    ",
    Severity.MEDIUM:   "[MEDIUM]  ",
    Severity.LOW:      "[LOW]     ",
    Severity.INFO:     "[INFO]    ",
}


def main():
    print(f"\n{SEP}")
    print("ThreatLens - Stage 2: Multi-Scanner Security Engine")
    print(f"Repository : {TEST_REPO}")
    print(f"Scanners   : Gitleaks | OSV-Scanner | Semgrep")
    print(SEP)

    engine = (
        SecurityEngine(repo_path=TEST_REPO)
        .add_scanner("Gitleaks",    GitleaksScanner())
        .add_scanner("OSV-Scanner", OsvScanner())
        .add_scanner("Semgrep",     SemgrepScanner())
    )

    print("\nRunning all scanners... (Semgrep may take a moment)\n")
    report = engine.scan()

    #  Scanner status table 
    print(f"\n{SEP2}")
    print(" Scanner Results")
    print(SEP2)
    for r in report.scanner_results:
        if r.success:
            print(f"  [OK]     {r.scanner_name:<15} {len(r.findings)} finding(s)")
        else:
            print(f"  [FAILED] {r.scanner_name:<15} {r.error[:60]}")

    if report.failed_scanners:
        print(f"\n  NOTE: Failed scanners did not stop the scan.")
        print(f"  Findings from {[r.scanner_name for r in report.succeeded_scanners]} are still reported.")

    #  Severity summary 
    print(f"\n{SEP2}")
    print(" Severity Summary")
    print(SEP2)
    print(f"  Total findings : {report.total}")
    for sev in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]:
        count = report.summary.get(str(sev), 0)
        bar = "#" * count
        print(f"  {sev:<8} : {count:>3}  {bar}")

    # Findings by category 
    if report.findings:
        categories = {}
        for f in report.findings:
            categories.setdefault(f.category, []).append(f)

        print(f"\n{SEP2}")
        print(" Findings (sorted by severity)")
        print(SEP2)

        for i, finding in enumerate(report.findings, 1):
            label = SEVERITY_LABEL.get(finding.severity, "[?]      ")
            print(f"\n  #{i:02d}  {label}  {finding.tool:<14} {finding.category}")
            print(f"       Rule : {finding.rule}")
            print(f"       File : {finding.file}  (line {finding.start_line})")
            print(f"       Desc : {finding.description[:120].splitlines()[0]}")
    else:
        print("\n  No findings detected.")

    #  Stage 2 conclusion 
    print(f"\n{SEP}")
    print(" Stage 2 Complete")
    print(SEP)
    print(f"  Scanners registered : {len(report.scanner_results)}")
    print(f"  Scanners succeeded  : {len(report.succeeded_scanners)}")
    print(f"  Scanners failed     : {len(report.failed_scanners)}")
    print(f"  Total findings      : {report.total}")
    print()
    print("  Phases complete:")
    print("    [6]  OSV-Scanner – dependency vulnerabilities")
    print("    [7]  Semgrep     – insecure code patterns")
    print("    [8]  Deduplication & severity sorting in SecurityEngine")
    print()
    print("  Next: Stage 3 – Analysis, Explanation and Reporting")
    print(SEP)


if __name__ == "__main__":
    main()
