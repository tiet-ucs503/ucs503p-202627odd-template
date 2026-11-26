
# run_phase5.py – SecurityEngine verification
#
# Demonstrates Phase 5: the SecurityEngine orchestrates Gitleaks,
# handles scanner failures gracefully, deduplicates findings,
# and sorts them by severity.
#
# Run: python run_phase5.py

import io
import logging
import sys
import os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine.security_engine import SecurityEngine
from scanners.gitleaks_scanner import GitleaksScanner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%H:%M:%S",
)

TEST_REPO = os.path.join(os.path.dirname(__file__), "test-repo")

SEP = "=" * 60


def main():
    print(f"\n{SEP}")
    print("ThreatLens - Phase 5: SecurityEngine")
    print(f"Repository: {TEST_REPO}")
    print(SEP)

    #  Build the engine and register scanners
    # In later phases, OSV-Scanner and Semgrep will be added here.
    engine = (
        SecurityEngine(repo_path=TEST_REPO)
        .add_scanner("Gitleaks", GitleaksScanner())
    )

    #  Run the scan 
    report = engine.scan()

    #  Scanner status 
    print(f"\n[Scanner Results]")
    for result in report.scanner_results:
        status = "OK" if result.success else "FAILED"
        msg = f"  [{status}] {result.scanner_name}"
        if not result.success:
            msg += f" - {result.error}"
        else:
            msg += f" - {len(result.findings)} finding(s)"
        print(msg)

    if report.failed_scanners:
        print(f"\n  Scanners that failed: {[r.scanner_name for r in report.failed_scanners]}")
        print("  (ThreatLens continues with results from successful scanners)")

  
    print(f"\n{SEP}")
    print(f"[Summary]  Total findings: {report.total}")
    for severity, count in report.summary.items():
        if count > 0:
            print(f"  {severity}: {count}")

    # ── Findings ───────────────────────────────────────────────
    if not report.findings:
        print("\n  No findings detected.")
    else:
        print(f"\n[Findings]  (sorted by severity)")
        for i, f in enumerate(report.findings, 1):
            print(f"\n  --- Finding #{i} ---")
            print(f"  Severity   : {f.severity}")
            print(f"  Tool       : {f.tool}")
            print(f"  Rule       : {f.rule}")
            print(f"  Category   : {f.category}")
            print(f"  File       : {f.file}  (line {f.start_line})")
            print(f"  Fingerprint: {f.fingerprint}")

    print(f"\n{SEP}")
    print("[OK] Phase 5 complete.")
    print("     SecurityEngine orchestrates scanners, deduplicates,")
    print("     and sorts findings. Ready for OSV + Semgrep in Phase 6/7.")
    print(SEP)


if __name__ == "__main__":
    main()
