# scanners/osv_scanner.py
# Phase 6 – OSV-Scanner integration
#
# Wraps the OSV-Scanner binary to detect known vulnerabilities in
# project dependencies (requirements.txt, package.json, etc.).
#
# OSV-Scanner output structure (v2):
# {
#   "results": [
#     {
#       "source": { "path": "requirements.txt", "type": "lockfile" },
#       "packages": [
#         {
#           "package": { "name": "requests", "version": "2.18.0", "ecosystem": "PyPI" },
#           "vulnerabilities": [ { "id": "PYSEC-2023-74", "summary": "...", ... } ],
#           "groups": [ { "ids": [...], "aliases": ["CVE-2023-32681", ...], "max_severity": "6.1" } ]
#         }
#       ]
#     }
#   ]
# }

import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path

from engine.finding import Finding, Severity

logger = logging.getLogger(__name__)


# ── Severity mapping from CVSS score ──────────────────────────

def _cvss_to_severity(score_str: str) -> Severity:
    """Convert a CVSS numeric score string to a ThreatLens Severity."""
    try:
        score = float(score_str)
    except (ValueError, TypeError):
        return Severity.MEDIUM

    if score >= 9.0:
        return Severity.CRITICAL
    if score >= 7.0:
        return Severity.HIGH
    if score >= 4.0:
        return Severity.MEDIUM
    if score > 0.0:
        return Severity.LOW
    return Severity.INFO


def _extract_cve(aliases: list[str]) -> str:
    """Return the first CVE identifier found in the aliases list."""
    for alias in aliases:
        if alias.startswith("CVE-"):
            return alias
    return aliases[0] if aliases else ""


def _build_osv_description(pkg_name: str, pkg_version: str, vuln_id: str, summary: str) -> str:
    return (
        f"Package '{pkg_name}' version {pkg_version} has a known vulnerability "
        f"({vuln_id}). {summary}"
    )


def _build_osv_risk(cve: str, score: str) -> str:
    cvss_info = f"CVSS score: {score}. " if score else ""
    cve_info = f"({cve}) " if cve else ""
    return (
        f"This vulnerability {cve_info}affects a dependency your project imports. "
        f"{cvss_info}"
        f"An attacker exploiting this vulnerability could compromise the security "
        f"of any application that uses this package."
    )


def _build_osv_recommendation(pkg_name: str, pkg_version: str, ecosystem: str) -> str:
    return (
        f"1. Upgrade '{pkg_name}' to the latest patched version.\n"
        f"   Current version: {pkg_version}\n\n"
        f"   Check for the fixed version:\n"
        f"   https://osv.dev/list?ecosystem={ecosystem}&q={pkg_name}\n\n"
        f"2. Run: pip install --upgrade {pkg_name}   (for PyPI packages)\n"
        f"3. Update your requirements.txt / lock file after upgrading.\n"
        f"4. Re-run ThreatLens to confirm the vulnerability is resolved."
    )


class OsvScanner:
    """ThreatLens wrapper for OSV-Scanner (dependency vulnerability detection).

    Detects known CVEs and security advisories in project dependencies
    by scanning lockfiles and manifest files (requirements.txt, etc.).

    Usage:
        scanner = OsvScanner()
        findings = scanner.scan("/path/to/repository")
    """

    # OSV-Scanner may be in PATH or in the project directory as a .exe
    DEFAULT_COMMANDS = ["osv-scanner", "osv-scanner.exe"] if os.name == "nt" else ["osv-scanner"]

    def __init__(self, osv_cmd: str = None):
        """
        Args:
            osv_cmd: Path or command name for the OSV-Scanner binary.
                     If None, auto-detects from PATH and project directory.
        """
        self.osv_cmd = osv_cmd or self._find_binary()

    def _find_binary(self) -> str:
        """Auto-detect the osv-scanner binary location."""
        # 1. Check PATH first
        for cmd in self.DEFAULT_COMMANDS:
            try:
                result = subprocess.run(
                    [cmd, "--version"],
                    capture_output=True, text=True, timeout=5,
                )
                if result.returncode == 0:
                    return cmd
            except (FileNotFoundError, PermissionError):
                continue

        # 2. Check same directory as the project root
        #    scanners/osv_scanner.py -> .parent = scanners/ -> .parent = project root
        project_root = Path(__file__).resolve().parent.parent
        names = ["osv-scanner.exe", "osv-scanner"] if os.name == "nt" else ["osv-scanner"]
        for name in names:
            candidate = project_root / name
            if candidate.exists() and (os.name == "nt" or os.access(candidate, os.X_OK)):
                logger.info("OSV-Scanner found at: %s", candidate)
                return str(candidate)

        return "osv-scanner"  # fallback – will fail gracefully in scan()

    def _check_installed(self) -> bool:
        try:
            result = subprocess.run(
                [self.osv_cmd, "--version"],
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

    def _run_osv_scanner(self, repo_path: Path) -> dict:
        """Execute osv-scanner and return parsed JSON output."""
        cmd = [
            self.osv_cmd,
            "scan",
            "--format", "json",
            "--recursive",      # also look in sub-folders (e.g. "project a/requirements.txt")
            str(repo_path),
        ]
        logger.info("Running OSV-Scanner: %s", " ".join(cmd))

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=120,
        )

        # OSV-Scanner exit codes:
        #   0   = scanned, no vulnerabilities
        #   1   = scanned, vulnerabilities found   (not an error)
        #   128 = no dependency files found at all (not an error - nothing to check)
        if result.returncode == 128:
            logger.info("OSV-Scanner found no dependency files (requirements.txt, package.json, ...).")
            return {}

        if result.returncode not in (0, 1):
            raise RuntimeError(
                f"OSV-Scanner exited with unexpected code {result.returncode}.\n"
                f"stderr: {result.stderr.strip()}"
            )

        if not result.stdout.strip():
            return {}

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"OSV-Scanner output is not valid JSON: {exc}") from exc

    def _parse_group(self, group: dict) -> tuple[str, str, str]:
        """Extract (primary_id, cve_alias, max_severity) from a vuln group."""
        ids      = group.get("ids", [])
        aliases  = group.get("aliases", [])
        max_sev  = group.get("max_severity", "")
        all_ids  = ids + aliases
        primary  = ids[0] if ids else ""
        cve      = _extract_cve(all_ids)
        return primary, cve, max_sev

    def _parse_results(self, data: dict, repo_path: Path) -> list[Finding]:
        findings: list[Finding] = []

        for result_block in data.get("results", []):
            source_path = result_block.get("source", {}).get("path", "")

            for pkg_block in result_block.get("packages", []):
                pkg      = pkg_block.get("package", {})
                pkg_name = pkg.get("name", "unknown")
                pkg_ver  = pkg.get("version", "unknown")
                ecosystem = pkg.get("ecosystem", "")

                groups = pkg_block.get("groups", [])
                vulns  = pkg_block.get("vulnerabilities", [])

                # Build a quick lookup: vuln id → summary
                vuln_summaries: dict[str, str] = {
                    v["id"]: v.get("summary", "") for v in vulns if "id" in v
                }

                for group in groups:
                    primary_id, cve, max_sev = self._parse_group(group)
                    severity   = _cvss_to_severity(max_sev)
                    summary    = vuln_summaries.get(primary_id, "")
                    vuln_label = cve or primary_id
                    fingerprint = f"osv:{pkg_name}:{pkg_ver}:{primary_id}"

                    # Reference URL: prefer CVE on osv.dev
                    ref_id  = cve if cve else primary_id
                    reference = f"https://osv.dev/vulnerability/{primary_id}"

                    finding = Finding(
                        tool         = "OSV-Scanner",
                        rule         = vuln_label,
                        category     = "Dependency Vulnerability",
                        severity     = severity,
                        file         = source_path,
                        start_line   = 0,
                        description  = _build_osv_description(pkg_name, pkg_ver, vuln_label, summary),
                        risk         = _build_osv_risk(cve, max_sev),
                        recommendation = _build_osv_recommendation(pkg_name, pkg_ver, ecosystem),
                        reference    = reference,
                        fingerprint  = fingerprint,
                    )
                    findings.append(finding)

        return findings

    def scan(self, repo_path: str) -> list[Finding]:
        """Scan the repository for vulnerable dependencies.

        Args:
            repo_path: Path to the repository root.

        Returns:
            List of Finding objects, one per vulnerability group per package.
        """
        if not self._check_installed():
            raise RuntimeError(
                f"OSV-Scanner not found (tried: {self.osv_cmd}). "
                "Download from: https://github.com/google/osv-scanner/releases"
            )

        path = self._validate_repo_path(repo_path)
        logger.info("OSV-Scanner scanning repository: %s", path)

        data = self._run_osv_scanner(path)

        if not data:
            logger.info("OSV-Scanner returned no output (no lockfiles found or no vulnerabilities).")
            return []

        findings = self._parse_results(data, path)
        logger.info("OSV-Scanner found %d vulnerability group(s).", len(findings))
        return findings