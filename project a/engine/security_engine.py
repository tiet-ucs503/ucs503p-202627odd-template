
# engine/security_engine.py
#
# Phase 5 – SecurityEngine
#
# The SecurityEngine is the central orchestrator of ThreatLens.
# It receives a repository path, runs every configured scanner,
# collects their findings, deduplicates them, sorts by severity,
# and returns one clean list of Finding objects.
#
# Design rules enforced here:
#   - One scanner failing does NOT stop the rest.
#   - Duplicate findings (same fingerprint) are removed.
#   - Findings are sorted: CRITICAL first, INFO last.
#   - Callers only need to know about SecurityEngine – not
#     about which scanners exist or how they work internally.

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol, runtime_checkable

from engine.finding import Finding, Severity

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Scanner protocol
#
# Every scanner module must implement one method: scan().
# This is a structural interface (Protocol) – no base class
# needed, just matching the method signature.
# ──────────────────────────────────────────────────────────────

@runtime_checkable
class Scanner(Protocol):
    def scan(self, repo_path: str) -> list[Finding]:
        """Scan the repository and return a list of Finding objects."""
        ...


# ──────────────────────────────────────────────────────────────
# ScannerResult
#
# Wraps the outcome of running one scanner so the engine can
# report which scanners succeeded and which failed.
# ──────────────────────────────────────────────────────────────

@dataclass
class ScannerResult:
    scanner_name: str
    success: bool
    findings: list[Finding] = field(default_factory=list)
    error: str = ""


# ──────────────────────────────────────────────────────────────
# Severity ordering for sorting
# ──────────────────────────────────────────────────────────────

SEVERITY_ORDER = {
    Severity.CRITICAL: 0,
    Severity.HIGH:     1,
    Severity.MEDIUM:   2,
    Severity.LOW:      3,
    Severity.INFO:     4,
}


# ──────────────────────────────────────────────────────────────
# SecurityEngine
# ──────────────────────────────────────────────────────────────

class SecurityEngine:
    """Orchestrates all ThreatLens security scanners.

    Usage:
        from engine.security_engine import SecurityEngine
        from scanners.gitleaks_scanner import GitleaksScanner

        engine = SecurityEngine(repo_path="./my-repo")
        engine.add_scanner("Gitleaks", GitleaksScanner())
        results = engine.scan()

        for finding in results.findings:
            print(finding)
    """

    def __init__(self, repo_path: str):
        """
        Args:
            repo_path: Path to the repository root to be scanned.
        """
        self.repo_path = str(Path(repo_path).resolve())
        self._scanners: list[tuple[str, Scanner]] = []

    # ── Scanner registration ───────────────────────────────────

    def add_scanner(self, name: str, scanner: Scanner) -> "SecurityEngine":
        """Register a scanner with the engine.

        Returns self so calls can be chained:
            engine.add_scanner("Gitleaks", GitleaksScanner())
                   .add_scanner("Semgrep",  SemgrepScanner())
        """
        if not isinstance(scanner, Scanner):
            raise TypeError(
                f"{name} does not implement the Scanner protocol "
                f"(missing scan(repo_path) method)."
            )
        self._scanners.append((name, scanner))
        logger.info("Registered scanner: %s", name)
        return self

    # ── Internal helpers ───────────────────────────────────────

    def _run_scanner(self, name: str, scanner: Scanner) -> ScannerResult:
        """Run one scanner and wrap the result.

        Any exception from the scanner is caught here so it
        cannot stop the other scanners from running.
        """
        logger.info("Running scanner: %s", name)
        try:
            findings = scanner.scan(self.repo_path)
            logger.info("%s returned %d finding(s).", name, len(findings))
            return ScannerResult(
                scanner_name=name,
                success=True,
                findings=findings,
            )
        except Exception as exc:
            logger.error("Scanner '%s' failed: %s", name, exc)
            return ScannerResult(
                scanner_name=name,
                success=False,
                error=str(exc),
            )

    def _deduplicate(self, findings: list[Finding]) -> list[Finding]:
        """Deduplicate and consolidate findings.

        Two-tier deduplication:
          1. Exact fingerprint deduplication: identical issues from multiple passes
             or redundant scans are discarded.
          2. Same-line semantic consolidation: multiple rules (e.g. several Semgrep
             rules or Semgrep + Gitleaks) firing on the exact same (file, start_line)
             for the same category are consolidated into a single primary finding.
             - The highest severity is retained.
             - Secondary rules are noted in the rule label and description so no context is lost.
             - Dependency advisories (start_line <= 0) remain distinct per CVE/GHSA.
        """
        # Tier 1: remove exact identical fingerprints
        seen_fingerprints: set[str] = set()
        tier1_unique: list[Finding] = []

        for f in findings:
            if not f.fingerprint:
                tier1_unique.append(f)
                continue
            if f.fingerprint not in seen_fingerprints:
                seen_fingerprints.add(f.fingerprint)
                tier1_unique.append(f)
            else:
                logger.debug("Identical fingerprint removed: %s (%s)", f.rule, f.fingerprint)

        # Tier 2: consolidate overlapping findings on the same line & category
        line_groups: dict[tuple[str, int, str], list[Finding]] = {}
        pass_through: list[Finding] = []

        for f in tier1_unique:
            # Only line-level findings (start_line > 0) are consolidated.
            # Dependency/package-level findings (start_line <= 0) remain individual.
            if f.start_line > 0 and f.file:
                key = (f.file.replace("\\", "/"), f.start_line, f.category)
                line_groups.setdefault(key, []).append(f)
            else:
                pass_through.append(f)

        consolidated: list[Finding] = list(pass_through)

        for key, group in line_groups.items():
            if len(group) == 1:
                consolidated.append(group[0])
                continue

            # Sort group so the most severe finding is first
            group.sort(
                key=lambda item: (
                    SEVERITY_ORDER.get(item.severity, 99),
                    0 if item.tool == "Gitleaks" else 1,
                )
            )
            primary = group[0]
            secondaries = group[1:]

            sec_rules = [s.rule for s in secondaries if s.rule != primary.rule]
            merged_rule = primary.rule
            if sec_rules:
                if len(sec_rules) == 1:
                    merged_rule = f"{primary.rule} (+1 related rule: {sec_rules[0]})"
                else:
                    merged_rule = f"{primary.rule} (+{len(sec_rules)} related rules)"

            # Build enriched description
            extra_lines = []
            for s in secondaries:
                extra_lines.append(f"  • [{s.severity}] {s.rule} ({s.tool}): {s.description.strip()}")

            merged_desc = primary.description
            if extra_lines:
                merged_desc += "\n\nAdditional related findings on this line:\n" + "\n".join(extra_lines)

            # References
            all_refs = [primary.reference] if primary.reference else []
            for s in secondaries:
                if s.reference and s.reference not in all_refs:
                    all_refs.append(s.reference)
            merged_ref = " | ".join(all_refs)

            consolidated_finding = Finding(
                tool=primary.tool,
                rule=merged_rule,
                category=primary.category,
                severity=primary.severity,
                file=primary.file,
                start_line=primary.start_line,
                end_line=primary.end_line or max((s.end_line for s in group), default=primary.start_line),
                start_column=primary.start_column,
                end_column=primary.end_column,
                description=merged_desc,
                risk=primary.risk,
                recommendation=primary.recommendation,
                reference=merged_ref,
                fingerprint=f"consolidated:{primary.tool.lower()}:{key[0]}:{key[1]}:{key[2].lower()}",
            )
            consolidated.append(consolidated_finding)

        removed = len(findings) - len(consolidated)
        if removed:
            logger.info("Deduplication and consolidation removed %d redundant finding(s).", removed)

        return consolidated

    def _sort_by_severity(self, findings: list[Finding]) -> list[Finding]:
        """Sort findings so the most severe appear first."""
        return sorted(
            findings,
            key=lambda f: (SEVERITY_ORDER.get(f.severity, 99), f.file, f.start_line),
        )

    # ── Public scan method ─────────────────────────────────────

    def scan(self) -> "ScanReport":
        """Run all registered scanners and return a ScanReport.

        The ScanReport contains:
          - findings: deduplicated, severity-sorted list of Finding
          - scanner_results: per-scanner success/failure details
          - summary: counts by severity

        Even if every scanner fails, a ScanReport is returned
        (with an empty findings list and all failures recorded).
        """
        if not self._scanners:
            logger.warning("No scanners registered – scan will produce no findings.")

        # Step 1: run every scanner
        scanner_results: list[ScannerResult] = []
        all_findings: list[Finding] = []

        for name, scanner in self._scanners:
            result = self._run_scanner(name, scanner)
            scanner_results.append(result)
            if result.success:
                all_findings.extend(result.findings)

        # Step 2: deduplicate
        unique_findings = self._deduplicate(all_findings)

        # Step 3: sort by severity
        sorted_findings = self._sort_by_severity(unique_findings)

        return ScanReport(
            repo_path=self.repo_path,
            findings=sorted_findings,
            scanner_results=scanner_results,
        )


# ──────────────────────────────────────────────────────────────
# ScanReport
#
# The final output of SecurityEngine.scan().
# Contains everything needed for report generation and GitHub
# integration in later phases.
# ──────────────────────────────────────────────────────────────

@dataclass
class ScanReport:
    repo_path: str
    findings: list[Finding]
    scanner_results: list[ScannerResult]

    @property
    def total(self) -> int:
        return len(self.findings)

    @property
    def summary(self) -> dict[str, int]:
        """Return finding counts grouped by severity level."""
        counts = {str(s): 0 for s in Severity}
        for f in self.findings:
            counts[str(f.severity)] += 1
        return counts

    @property
    def failed_scanners(self) -> list[ScannerResult]:
        return [r for r in self.scanner_results if not r.success]

    @property
    def succeeded_scanners(self) -> list[ScannerResult]:
        return [r for r in self.scanner_results if r.success]

    def has_severity(self, severity: Severity) -> bool:
        return any(f.severity == severity for f in self.findings)
