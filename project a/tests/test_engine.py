# tests/test_engine.py
# Unit tests for SecurityEngine orchestration, deduplication, and consolidation.

import unittest
from engine.finding import Finding, Severity
from engine.security_engine import SecurityEngine, ScannerResult
from reporting import json_report


class MockScanner:
    def __init__(self, findings=None, should_fail=False):
        self.findings = findings or []
        self.should_fail = should_fail

    def scan(self, repo_path: str):
        if self.should_fail:
            raise RuntimeError("Mock scanner simulated failure")
        return list(self.findings)


class TestSecurityEngineDeduplication(unittest.TestCase):

    def test_exact_fingerprint_deduplication(self):
        f1 = Finding(
            tool="Semgrep",
            rule="rule-1",
            category="Injection",
            severity=Severity.HIGH,
            file="app/db.py",
            start_line=10,
            fingerprint="fp-1",
        )
        f2 = Finding(
            tool="Semgrep",
            rule="rule-1",
            category="Injection",
            severity=Severity.HIGH,
            file="app/db.py",
            start_line=10,
            fingerprint="fp-1",  # identical fingerprint
        )

        engine = SecurityEngine(repo_path=".")
        engine.add_scanner("Scanner1", MockScanner([f1, f2]))
        report = engine.scan()

        self.assertEqual(len(report.findings), 1)
        self.assertEqual(report.findings[0].fingerprint, "fp-1")

    def test_same_line_multi_rule_semgrep_consolidation(self):
        """Simulate two distinct Semgrep rules flagging the exact same line."""
        f_high = Finding(
            tool="Semgrep",
            rule="python.django.security.injection.raw-sql",
            category="Injection",
            severity=Severity.HIGH,
            file="app/db.py",
            start_line=42,
            description="Raw SQL formatted with user input.",
            fingerprint="semgrep:raw-sql:app/db.py:42",
        )
        f_med = Finding(
            tool="Semgrep",
            rule="python.lang.security.audit.sqli.taint",
            category="Injection",
            severity=Severity.MEDIUM,
            file="app/db.py",
            start_line=42,
            description="Tainted string passed to query execution.",
            fingerprint="semgrep:taint:app/db.py:42",
        )

        engine = SecurityEngine(repo_path=".")
        engine.add_scanner("Semgrep", MockScanner([f_high, f_med]))
        report = engine.scan()

        self.assertEqual(len(report.findings), 1)
        res = report.findings[0]
        # Highest severity retained
        self.assertEqual(res.severity, Severity.HIGH)
        # Merged rule name indicates consolidated rules
        self.assertIn("raw-sql", res.rule)
        self.assertIn("+1 related rule", res.rule)
        # Description contains both details
        self.assertIn("Raw SQL", res.description)
        self.assertIn("Tainted string", res.description)

    def test_cross_scanner_secret_consolidation(self):
        """Gitleaks and Semgrep both flag a secret on the same line."""
        f_gitleaks = Finding(
            tool="Gitleaks",
            rule="github-pat",
            category="Secret",
            severity=Severity.CRITICAL,
            file="config.py",
            start_line=15,
            description="Hardcoded GitHub Personal Access Token.",
            fingerprint="gitleaks:config.py:15",
        )
        f_semgrep = Finding(
            tool="Semgrep",
            rule="generic.secrets.token",
            category="Secret",
            severity=Severity.HIGH,
            file="config.py",
            start_line=15,
            description="Potential sensitive token detected.",
            fingerprint="semgrep:config.py:15",
        )

        engine = SecurityEngine(repo_path=".")
        engine.add_scanner("Gitleaks", MockScanner([f_gitleaks]))
        engine.add_scanner("Semgrep", MockScanner([f_semgrep]))
        report = engine.scan()

        self.assertEqual(len(report.findings), 1)
        res = report.findings[0]
        # Dedicated tool & highest severity preferred
        self.assertEqual(res.tool, "Gitleaks")
        self.assertEqual(res.severity, Severity.CRITICAL)
        self.assertIn("+1 related rule", res.rule)

    def test_dependency_findings_not_merged_on_line_zero(self):
        """OSV dependency findings have line 0 and should each remain distinct."""
        f_cve1 = Finding(
            tool="OSV-Scanner",
            rule="CVE-2023-1111",
            category="Dependency Vulnerability",
            severity=Severity.HIGH,
            file="requirements.txt",
            start_line=0,
            fingerprint="osv:flask:2.0:CVE-2023-1111",
        )
        f_cve2 = Finding(
            tool="OSV-Scanner",
            rule="CVE-2023-2222",
            category="Dependency Vulnerability",
            severity=Severity.CRITICAL,
            file="requirements.txt",
            start_line=0,
            fingerprint="osv:requests:2.1:CVE-2023-2222",
        )

        engine = SecurityEngine(repo_path=".")
        engine.add_scanner("OSV-Scanner", MockScanner([f_cve1, f_cve2]))
        report = engine.scan()

        self.assertEqual(len(report.findings), 2)
        # Severity ordering: CRITICAL comes first
        self.assertEqual(report.findings[0].severity, Severity.CRITICAL)
        self.assertEqual(report.findings[1].severity, Severity.HIGH)

    def test_scanner_failure_resilience(self):
        """Failure of one scanner does not crash the engine or stop other scanners."""
        f_good = Finding(
            tool="Gitleaks",
            rule="generic-api-key",
            category="Secret",
            severity=Severity.HIGH,
            file="secret.txt",
            start_line=1,
            fingerprint="fp-good",
        )

        engine = SecurityEngine(repo_path=".")
        engine.add_scanner("FailingScanner", MockScanner(should_fail=True))
        engine.add_scanner("GoodScanner", MockScanner([f_good]))
        report = engine.scan()

        self.assertEqual(len(report.findings), 1)
        self.assertEqual(len(report.failed_scanners), 1)
        self.assertEqual(report.failed_scanners[0].scanner_name, "FailingScanner")

    def test_json_contract_conformance(self):
        """Verify the generated JSON report conforms to Schema Version 1."""
        f = Finding(
            tool="Semgrep",
            rule="test-rule",
            category="Code Security",
            severity=Severity.MEDIUM,
            file="src/index.js",
            start_line=5,
            start_column=2,
            end_line=5,
            end_column=20,
            description="Testing message",
            risk="Testing risk",
            recommendation="Testing fix",
            fingerprint="fp-test",
        )

        engine = SecurityEngine(repo_path=".")
        engine.add_scanner("TestScanner", MockScanner([f]))
        report = engine.scan()

        json_dict = json_report.build_json(report, {"repository": "owner/repo", "branch": "main"})
        self.assertEqual(json_dict["schema_version"], 1)
        self.assertEqual(json_dict["status"], "ok")
        self.assertEqual(json_dict["total"], 1)
        self.assertEqual(len(json_dict["findings"]), 1)

        item = json_dict["findings"][0]
        self.assertEqual(item["line"], 5)
        self.assertEqual(item["column"], 2)
        self.assertEqual(item["severity"], "MEDIUM")
        self.assertEqual(item["tool"], "Semgrep")


if __name__ == "__main__":
    unittest.main()
