
# reporting/report_generator.py
#
# Phase 11 - Security Report Generator
#
# Takes a ScanReport from the SecurityEngine and generates a beautifully
# formatted, developer-friendly text report. This is the output that
# users (and eventually GitHub PR comments) will see.

import datetime
from engine.security_engine import ScanReport
from engine.finding import Severity

class ReportGenerator:
    """Generates human-readable security reports from scan results."""

    def __init__(self):
        self.sep = "=" * 70
        self.sub_sep = "-" * 70

    def generate_text_report(self, report: ScanReport) -> str:
        """Generate a complete plain-text report."""
        lines = []

        # ── Header ───────────────────────────────────────────
        lines.append(self.sep)
        lines.append("🛡️  THREATLENS SECURITY REPORT")
        lines.append(self.sep)
        
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"Repository   : {report.repo_path}")
        lines.append(f"Scan Time    : {now}")
        lines.append(f"Scanners Run : {len(report.scanner_results)}")
        
        # ── Summary ──────────────────────────────────────────
        lines.append("")
        lines.append("📊 SEVERITY SUMMARY")
        lines.append(self.sub_sep)
        lines.append(f"Total Findings : {report.total}")
        
        for sev in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]:
            count = report.summary.get(str(sev), 0)
            if count > 0:
                bar = "█" * min(count, 30) # cap bar length at 30
                lines.append(f"{str(sev):<10} : {count:>3} {bar}")
                
        # ── Failed Scanners (if any) ─────────────────────────
        if report.failed_scanners:
            lines.append("")
            lines.append("⚠️  SCANNER FAILURES")
            lines.append(self.sub_sep)
            for r in report.failed_scanners:
                err = r.error or "unknown error"
                lines.append(f"- {r.scanner_name} failed: {err[:100]}{'...' if len(err) > 100 else ''}")

        # ── Findings ─────────────────────────────────────────
        if report.total == 0:
            lines.append("")
            if report.failed_scanners:
                lines.append("⚠️  No issues found by the scanners that ran, but the scan is INCOMPLETE.")
                lines.append("    Fix the failed scanner(s) above and scan again.")
            else:
                lines.append("✅ No security issues found! Great job.")
            lines.append(self.sep)
            return "\n".join(lines)

        lines.append("")
        lines.append("🔍 DETAILED FINDINGS")
        lines.append(self.sep)

        for i, f in enumerate(report.findings, 1):
            # Header for this finding
            lines.append("")
            lines.append(f"[{i:02d}] {f.severity} – {f.category}")
            lines.append(f"     Tool: {f.tool} | Rule: {f.rule}")
            lines.append(f"     File: {f.file} (Line {f.start_line})")
            lines.append("")
            
            # What is wrong?
            lines.append("     📋 What is wrong?")
            for line in f.description.splitlines():
                lines.append(f"        {line}")
            lines.append("")
            
            # Why is it dangerous?
            lines.append("     ⚠️  Why is it dangerous?")
            for line in f.risk.splitlines():
                lines.append(f"        {line}")
            lines.append("")
            
            # Recommended fix
            lines.append("     🔧 Recommended fix:")
            for line in f.recommendation.splitlines():
                lines.append(f"        {line}")
            
            if f.reference:
                lines.append("")
                lines.append(f"     📖 Reference: {f.reference}")
                
            lines.append("")
            lines.append(self.sub_sep)

        lines.append("")
        lines.append("End of Report.")
        return "\n".join(lines)
