
# scanners/semgrep_scanner.py
# Phase 7 – Semgrep integration
#
# Wraps the Semgrep CLI to detect insecure code patterns.
#
# Semgrep JSON output structure:
# {
#   "results": [
#     {
#       "check_id": "generic.secrets.security.detected-slack-webhook...",
#       "path": "test-repo/config.py",
#       "start": { "line": 24, "col": 22 },
#       "end":   { "line": 24, "col": 99 },
#       "extra": {
#         "message": "Slack Webhook detected",
#         "severity": "ERROR",
#         "fingerprint": "...",
#         "metadata": {
#           "cwe": ["CWE-798: ..."],
#           "owasp": ["A07:2021 - ..."],
#           "confidence": "LOW",
#           "category": "security",
#           "references": [...]
#         }
#       }
#     }
#   ],
#   "errors": []
# }

import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from engine.finding import Finding, Severity

logger = logging.getLogger(__name__)


# ── Severity mapping from Semgrep severity strings ────────────

SEMGREP_SEVERITY_MAP: dict[str, Severity] = {
    "ERROR":   Severity.HIGH,
    "WARNING": Severity.MEDIUM,
    "INFO":    Severity.LOW,
    "NOTE":    Severity.INFO,
}


def _semgrep_severity(raw_severity: str) -> Severity:
    return SEMGREP_SEVERITY_MAP.get(raw_severity.upper(), Severity.MEDIUM)


def _extract_cwe(cwe_list: list[str]) -> str:
    """Return the first CWE identifier from the list, e.g. 'CWE-798'."""
    if not cwe_list:
        return ""
    first = cwe_list[0]
    return first.split(":")[0].strip()   # "CWE-798: Use of..." → "CWE-798"


def _categorize(check_id: str, metadata: dict) -> str:
    """Infer a broad category from the rule ID and metadata."""
    rule_lower = check_id.lower()
    category_meta = metadata.get("category", "").lower()

    if "secret" in rule_lower or "credential" in rule_lower or "api-key" in rule_lower:
        return "Secret"
    if "injection" in rule_lower or "sqli" in rule_lower or "xss" in rule_lower:
        return "Injection"
    if "auth" in rule_lower or "jwt" in rule_lower or "session" in rule_lower:
        return "Authentication"
    if "crypto" in rule_lower or "tls" in rule_lower or "ssl" in rule_lower:
        return "Cryptography"
    if "path" in rule_lower or "traversal" in rule_lower:
        return "Path Traversal"
    if "deserializ" in rule_lower or "pickle" in rule_lower:
        return "Deserialization"
    return "Code Security"


def _build_semgrep_recommendation(check_id: str, message: str, metadata: dict) -> str:
    refs = metadata.get("references", [])
    ref_lines = "\n".join(f"   - {r}" for r in refs[:3]) if refs else "   (no references available)"
    cwe = _extract_cwe(metadata.get("cwe", []))
    cwe_note = f"\n   CWE: {cwe}" if cwe else ""

    return (
        f"Review and fix the issue flagged by rule '{check_id}'.\n"
        f"Semgrep message: {message}\n"
        f"{cwe_note}\n\n"
        f"References:\n{ref_lines}\n\n"
        f"General guidance:\n"
        f"   - Never hardcode secrets, tokens, or credentials in source code.\n"
        f"   - Store sensitive values in environment variables or a secrets manager.\n"
        f"   - Consult OWASP guidelines for secure coding patterns."
    )


def _build_semgrep_risk(check_id: str, metadata: dict) -> str:
    owasp = metadata.get("owasp", [])
    owasp_str = f" ({owasp[0]})" if owasp else ""
    cwe = _extract_cwe(metadata.get("cwe", []))
    cwe_str = f" Classified as {cwe}." if cwe else ""

    return (
        f"The pattern detected by Semgrep represents a known security weakness"
        f"{owasp_str}.{cwe_str} "
        f"If exploited, it may allow an attacker to gain unauthorised access, "
        f"extract sensitive data, or compromise the integrity of the system."
    )


def _make_fingerprint(check_id: str, file_path: str, start_line: int) -> str:
    return f"semgrep:{check_id}:{file_path}:{start_line}"


class SemgrepScanner:
    """ThreatLens wrapper for Semgrep (code security pattern detection).

    Runs Semgrep with the 'auto' ruleset, which applies community-maintained
    rules appropriate for the detected languages in the repository.

    Usage:
        scanner = SemgrepScanner()
        findings = scanner.scan("/path/to/repository")
    """

    def __init__(self, semgrep_cmd: str = "semgrep", config: str = "auto"):
        """
        Args:
            semgrep_cmd: Command to invoke Semgrep (default: 'semgrep').
            config:      Semgrep ruleset. 'auto' selects rules automatically.
                         Can also be a path to a custom .yaml rule file.
        """
        if semgrep_cmd == "semgrep":
            # Auto-detect semgrep in the current Python environment (e.g. virtualenv)
            py_bin_dir = Path(sys.executable).parent
            bin_name = "semgrep.exe" if os.name == "nt" else "semgrep"
            candidate = py_bin_dir / bin_name
            if candidate.exists():
                semgrep_cmd = str(candidate)
            elif shutil.which("semgrep"):
                semgrep_cmd = shutil.which("semgrep")

        self.semgrep_cmd = semgrep_cmd
        self.config = config

    def _check_installed(self) -> bool:
        try:
            result = subprocess.run(
                [self.semgrep_cmd, "--version"],
                capture_output=True, text=True, timeout=10,
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False

    def _validate_repo_path(self, repo_path: str) -> Path:
        path = Path(repo_path).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Repository path does not exist: {repo_path}")
        if not path.is_dir():
            raise ValueError(f"Repository path is not a directory: {repo_path}")
        return path

    def _run_semgrep(self, repo_path: Path) -> dict:
        """Execute semgrep and return parsed JSON output."""
        cmd = [
            self.semgrep_cmd,
            "scan",
            "--config", self.config,
            "--json",
            "--quiet",          # suppress progress output
            "--no-git-ignore",  # scan all files, not just tracked ones
            str(repo_path),
        ]
        logger.info("Running Semgrep: %s", " ".join(cmd))

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=180,   # 3-minute timeout (Semgrep can be slow on first run)
        )

        # Semgrep exits with 1 when findings exist – that's expected.
        if result.returncode not in (0, 1):
            raise RuntimeError(
                f"Semgrep exited with unexpected code {result.returncode}.\n"
                f"stderr: {result.stderr.strip()[:500]}"
            )

        output = result.stdout.strip()
        if not output:
            return {}

        try:
            return json.loads(output)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Semgrep output is not valid JSON: {exc}") from exc

    def _parse_results(self, data: dict, repo_path: Path) -> list[Finding]:
        findings: list[Finding] = []

        for raw in data.get("results", []):
            check_id   = raw.get("check_id", "unknown-rule")
            file_path  = raw.get("path", "")
            start      = raw.get("start", {})
            end        = raw.get("end", {})
            extra      = raw.get("extra", {})
            metadata   = extra.get("metadata", {})

            start_line = start.get("line", 0)
            end_line   = end.get("line", 0)
            start_col  = start.get("col", 0)
            end_col    = end.get("col", 0)

            message       = extra.get("message", "")
            raw_severity  = extra.get("severity", "WARNING")
            refs          = metadata.get("references", [])
            reference     = refs[0] if refs else f"https://semgrep.dev/r/{check_id}"

            # Make path relative to repo root if possible
            try:
                rel_path = str(Path(file_path).relative_to(repo_path))
            except ValueError:
                rel_path = file_path

            # Skip findings in generated/report files (e.g. gitleaks-report.json)
            # to avoid noise from our own scanner output being scanned
            rel_lower = rel_path.lower()
            if any(x in rel_lower for x in ["gitleaks-report", "osv-report", "semgrep-report", "phase1_findings"]):
                logger.debug("Skipping scan-output file: %s", rel_path)
                continue

            finding = Finding(
                tool         = "Semgrep",
                rule         = check_id,
                category     = _categorize(check_id, metadata),
                severity     = _semgrep_severity(raw_severity),
                file         = rel_path,
                start_line   = start_line,
                end_line     = end_line,
                start_column = start_col,
                end_column   = end_col,
                description  = (
                    f"Semgrep rule '{check_id}' flagged a potential security issue.\n"
                    f"Message: {message}"
                ),
                risk           = _build_semgrep_risk(check_id, metadata),
                recommendation = _build_semgrep_recommendation(check_id, message, metadata),
                reference      = reference,
                fingerprint    = _make_fingerprint(check_id, rel_path, start_line),
            )
            findings.append(finding)

        return findings

    def scan(self, repo_path: str) -> list[Finding]:
        """Scan the repository for insecure code patterns using Semgrep.

        Args:
            repo_path: Path to the repository root.

        Returns:
            List of Finding objects.
        """
        if not self._check_installed():
            raise RuntimeError(
                "Semgrep is not installed. Install with: pip install semgrep"
            )

        path = self._validate_repo_path(repo_path)
        logger.info("Semgrep scanning repository: %s", path)

        data = self._run_semgrep(path)
        if not data:
            logger.info("Semgrep returned no output.")
            return []

        findings = self._parse_results(data, path)
        logger.info("Semgrep found %d finding(s).", len(findings))
        return findings
