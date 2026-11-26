

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from engine.finding import Finding, Severity


logger = logging.getLogger(__name__)


GITLEAKS_SEVERITY_MAP: dict[str, Severity] = {
    # Specific, high-value secrets → HIGH
    "github-pat":                   Severity.HIGH,
    "github-oauth":                 Severity.HIGH,
    "github-app-token":             Severity.HIGH,
    "aws-access-token":             Severity.HIGH,
    "aws-secret-key":               Severity.HIGH,
    "slack-webhook-url":            Severity.HIGH,
    "slack-bot-token":              Severity.HIGH,
    "sendgrid-api-token":           Severity.HIGH,
    "stripe-api-key":               Severity.HIGH,
    "twilio-api-key":               Severity.HIGH,
    "google-api-key":               Severity.HIGH,
    "private-key":                  Severity.CRITICAL,
    "rsa-private-key":              Severity.CRITICAL,
    "ssh-private-key":              Severity.CRITICAL,
    "generic-api-key":              Severity.MEDIUM,
    "generic-password":             Severity.MEDIUM,
    "generic-secret":               Severity.MEDIUM,
    "hardcoded-password":           Severity.MEDIUM,
    "database-password":            Severity.MEDIUM,
}

DEFAULT_SEVERITY = Severity.MEDIUM


def _redact(value: str) -> str:
    """Replace a secret value with a redacted placeholder.

    We keep the first 4 characters so a developer can identify
    which secret it might be (e.g. 'ghp_***' for GitHub PATs)
    without exposing the full credential.

    Example:
        'ghp_FakeGithubToken123' → 'ghp_***'
        'SuperSecretPassword'    → 'Supe***'
    """
    if not value or len(value) <= 4:
        return "[REDACTED]"
    return value[:4] + "***"


def _map_severity(rule_id: str) -> Severity:
    """Look up the severity for a given Gitleaks rule ID.

    Falls back to DEFAULT_SEVERITY if the rule is unknown.
    """
    return GITLEAKS_SEVERITY_MAP.get(rule_id.lower(), DEFAULT_SEVERITY)


def _build_description(rule_id: str, description: str) -> str:
    """Build a plain-English 'what is wrong' sentence."""
    return (
        f"A possible secret was detected by Gitleaks rule '{rule_id}'. "
        f"Gitleaks description: {description}"
    )


def _build_risk(rule_id: str) -> str:
    """Explain why this finding is dangerous."""
    rule_lower = rule_id.lower()
    if "private-key" in rule_lower or "ssh" in rule_lower:
        return (
            "A private cryptographic key in source code can allow anyone "
            "with read access to the repository to impersonate servers, "
            "decrypt sensitive communications, or authenticate as a trusted party."
        )
    if "aws" in rule_lower:
        return (
            "Exposed AWS credentials can allow an attacker to access, modify, "
            "or delete cloud resources, potentially leading to data breaches "
            "and significant financial cost."
        )
    if "github" in rule_lower:
        return (
            "An exposed GitHub token allows anyone who obtains it to read or "
            "modify repositories, create webhooks, or perform actions on behalf "
            "of the authenticated user or organisation."
        )
    return (
        "A hardcoded credential in source code can be accessed by anyone who "
        "can read the repository (current collaborators, past collaborators, "
        "or anyone if the repository is made public). The credential should "
        "be considered compromised."
    )


def _build_recommendation(rule_id: str) -> str:
    """Provide actionable remediation advice."""
    env_var_name = rule_id.upper().replace("-", "_")
    return (
        f"1. Revoke and rotate the exposed credential immediately.\n"
        f"2. Remove it from the source code and all git history "
        f"   (use 'git filter-repo' or BFG Repo Cleaner).\n"
        f"3. Store it in an environment variable or a secrets manager.\n\n"
        f"   Before (insecure):\n"
        f"       SECRET = \"<actual-value>\"\n\n"
        f"   After (secure):\n"
        f"       import os\n"
        f"       SECRET = os.getenv(\"{env_var_name}\")"
    )


def _parse_raw_finding(raw: dict, repo_path: str) -> Finding:
    """Convert one raw Gitleaks JSON object into a Finding.

    The raw Gitleaks JSON looks like:
    {
        "RuleID":      "github-pat",
        "Description": "Uncovered a GitHub Personal Access Token...",
        "StartLine":   29,
        "EndLine":     29,
        "StartColumn": 18,
        "EndColumn":   57,
        "Match":       "ghp_FakeGithubToken...",
        "Secret":      "ghp_FakeGithubToken...",   ← NEVER stored
        "File":        "app.py",
        "Commit":      "77ee3c9...",
        "Entropy":     4.334,
        "Fingerprint": "77ee3c9...:app.py:github-pat:29"
    }
    """
    rule_id     = raw.get("RuleID", "unknown")
    description = raw.get("Description", "")
    file_path   = raw.get("File", "")
    start_line  = raw.get("StartLine", 0)
    end_line    = raw.get("EndLine", 0)
    start_col   = raw.get("StartColumn", 0)
    end_col     = raw.get("EndColumn", 0)
    fingerprint = raw.get("Fingerprint", "")

  
    secret_hint = _redact(raw.get("Secret", ""))

    severity = _map_severity(rule_id)

    return Finding(
        tool         = "Gitleaks",
        rule         = rule_id,
        category     = "Secret",
        severity     = severity,
        file         = file_path,
        start_line   = start_line,
        end_line     = end_line,
        start_column = start_col,
        end_column   = end_col,
        description  = (
            _build_description(rule_id, description)
            + f"\n\nSecret hint (redacted): {secret_hint}"
        ),
        risk           = _build_risk(rule_id),
        recommendation = _build_recommendation(rule_id),
        reference      = f"https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml",
        fingerprint    = fingerprint,
    )



class GitleaksScanner:
    """ThreatLens wrapper for the Gitleaks secret scanner.

    Usage:
        scanner = GitleaksScanner()
        findings = scanner.scan("/path/to/repository")
        for f in findings:
            print(f)
    """

    # Gitleaks normally exits 1 for BOTH "leaks found" and "crashed".
    # We ask it to use 3 for leaks, so 1 always means a real error.
    LEAKS_EXIT_CODE = 3

    def __init__(self, gitleaks_cmd: str = "gitleaks", no_git: bool = False):
        """
        Args:
            gitleaks_cmd: The command used to invoke Gitleaks.
                          Defaults to 'gitleaks': looked up on PATH, then
                          next to threatlens.py (like osv-scanner.exe).
            no_git:       Scan the files on disk instead of git commits.
                          Used for our shallow GitHub clones: the git history
                          is only one commit anyway, and scanning files means
                          the junk folders we deleted (venvs, node_modules)
                          are really skipped.
        """
        self.gitleaks_cmd = self._resolve_cmd(gitleaks_cmd)
        self.no_git = no_git

    @staticmethod
    def _resolve_cmd(cmd: str) -> str:
        """Find gitleaks on PATH, else in the project folder (gitleaks.exe on Windows)."""
        if cmd != "gitleaks":
            return cmd                      # the caller gave an explicit command/path
        if shutil.which("gitleaks"):
            return "gitleaks"
        project_root = Path(__file__).resolve().parent.parent
        names = ["gitleaks.exe", "gitleaks"] if os.name == "nt" else ["gitleaks"]
        for name in names:
            candidate = project_root / name
            if candidate.is_file() and (os.name == "nt" or os.access(candidate, os.X_OK)):
                logger.info("Gitleaks found at: %s", candidate)
                return str(candidate)
        return cmd                          # _check_installed() will report it missing

 

    def _validate_repo_path(self, repo_path: str) -> Path:
        """Verify the repository path exists and looks like a git repo.

        Returns:
            A resolved Path object.

        Raises:
            FileNotFoundError: if path does not exist.
            ValueError: if path is not a directory.
        """
        path = Path(repo_path).resolve()
        if not path.exists():
            raise FileNotFoundError(
                f"Repository path does not exist: {repo_path}"
            )
        if not path.is_dir():
            raise ValueError(
                f"Repository path is not a directory: {repo_path}"
            )

        if not (path / ".git").exists():
            logger.warning(
                "No .git directory found in %s. "
                "Gitleaks may not scan git history. "
                "Using --no-git flag to scan files only.",
                repo_path,
            )
        return path

    def _check_installed(self) -> bool:
        """Check that Gitleaks is available on the system.

        Returns:
            True if Gitleaks is installed, False otherwise.
        """
        try:
            result = subprocess.run(
                [self.gitleaks_cmd, "version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return result.returncode == 0
        except (FileNotFoundError, PermissionError, subprocess.TimeoutExpired):
            return False

    # ── Core scan logic ───────────────────────────────────────

    def _run_gitleaks(self, repo_path: Path, report_path: str) -> subprocess.CompletedProcess:
        """Execute the Gitleaks CLI and write JSON to report_path.

        Gitleaks exit codes (with --exit-code 3):
            0  – no leaks found
            3  – leaks found  (NOT a true error)
            anything else (usually 1) – Gitleaks itself failed

        Returns:
            The CompletedProcess result.
        """
        has_git = (repo_path / ".git").exists()

        cmd = [
            self.gitleaks_cmd,
            "detect",
            "--source", str(repo_path),
            "--report-format", "json",
            "--report-path", report_path,
            "--exit-code", str(self.LEAKS_EXIT_CODE),
        ]
        if self.no_git or not has_git:
            cmd.append("--no-git")

        logger.info("Running Gitleaks: %s", " ".join(cmd))

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=120,   # 2-minute timeout
        )


        if result.returncode not in (0, self.LEAKS_EXIT_CODE):
            raise RuntimeError(
                f"Gitleaks exited with unexpected code {result.returncode}.\n"
                f"stderr: {result.stderr.strip()}"
            )

        return result

    def _read_report(self, report_path: str) -> list[dict]:
        """Read and parse the JSON report file written by Gitleaks.

        Returns:
            A list of raw finding dicts (may be empty).

        Raises:
            RuntimeError: if the file cannot be read or parsed.
        """
        if not os.path.exists(report_path):
            # Gitleaks doesn't always write the file when there are no findings
            logger.info("No Gitleaks report file found at %s (likely no findings).", report_path)
            return []

        try:
            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read().strip()

            if not content or content == "null":
                return []

            data = json.loads(content)

            if not isinstance(data, list):
                raise ValueError(f"Expected JSON array, got {type(data).__name__}")

            return data

        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Gitleaks report is not valid JSON: {exc}") from exc


    def scan(self, repo_path: str) -> list[Finding]:
        """Run a full Gitleaks scan on the given repository path.

        This is the main entry point called by the SecurityEngine.

        Args:
            repo_path: Absolute or relative path to the repository root.

        Returns:
            A list of Finding objects (may be empty if nothing found).
            Secrets are always redacted before returning.

        Raises:
            RuntimeError: if Gitleaks is not installed.
            FileNotFoundError: if repo_path does not exist.
        """
        # Step 1 – verify the tool is installed
        if not self._check_installed():
            raise RuntimeError(
                "Gitleaks is not installed or not on PATH. "
                "Install it from: https://github.com/gitleaks/gitleaks#getting-started"
            )

        path = self._validate_repo_path(repo_path)

        with tempfile.NamedTemporaryFile(
            suffix="-gitleaks-report.json",
            delete=False,
            mode="w",
        ) as tmp:
            report_path = tmp.name

        try:
       
            logger.info("Scanning repository: %s", path)
            result = self._run_gitleaks(path, report_path)

            raw_findings = self._read_report(report_path)
            if result.returncode == self.LEAKS_EXIT_CODE and not raw_findings:
                raise RuntimeError(
                    "Gitleaks reported leaks but its JSON report was empty - "
                    "refusing to report this as 'no secrets found'."
                )
            logger.info("Gitleaks found %d raw finding(s).", len(raw_findings))

            findings: list[Finding] = []
            for raw in raw_findings:
                try:
                    finding = _parse_raw_finding(raw, str(path))
                    findings.append(finding)
                except Exception as exc:
                    # A malformed individual finding should not abort the scan
                    logger.warning("Could not parse Gitleaks finding: %s", exc)

            return findings

        finally:

            if os.path.exists(report_path):
                os.remove(report_path)
