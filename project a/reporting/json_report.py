# reporting/json_report.py
#
# Machine-readable version of the ThreatLens report, for the VS Code
# extension (Stage 5) and any other program that runs ThreatLens.
#
# The shape of this JSON is a CONTRACT with the extension: if you rename
# or remove a field, the extension breaks. So:
#   - "schema_version" goes up whenever a field is removed or renamed
#   - adding NEW fields is always safe (old readers just ignore them)
#
# Paths are always relative to the scanned folder and use "/":
#   "app/config.py"  - the extension joins it with its workspace folder.
# Lines/columns are 1-based (like editors show them); null = unknown
# (e.g. an OSV finding is about a whole requirements.txt, not one line).

import json
from pathlib import Path

from engine.finding import Finding
from engine.security_engine import ScanReport

SCHEMA_VERSION = 1


def _relative_path(file: str, root: Path) -> str:
    """'C:/.../root/app/config.py' -> 'app/config.py'; relative paths stay as-is."""
    if not file:
        return file
    path = Path(file)
    if path.is_absolute():
        try:
            path = path.resolve().relative_to(root)
        except ValueError:
            pass
    return path.as_posix()


def _position(value: int) -> int | None:
    """Scanners use 0 for 'no position'; JSON uses null for that."""
    return value if value and value > 0 else None


def finding_to_dict(f: Finding, root: Path) -> dict:
    return {
        "file":         _relative_path(f.file, root),
        "line":         _position(f.start_line),
        "column":       _position(f.start_column),
        "end_line":     _position(f.end_line),
        "end_column":   _position(f.end_column),
        "severity":     str(f.severity),        # CRITICAL | HIGH | MEDIUM | LOW | INFO
        "category":     f.category,             # "Secret", "Dependency Vulnerability", ...
        "tool":         f.tool,                 # "Gitleaks" | "OSV-Scanner" | "Semgrep"
        "rule":         f.rule,
        "message":      f.description,          # what is wrong
        "risk":         f.risk,                 # why it matters
        "fix":          f.recommendation,       # how to fix
        "reference":    f.reference,
        "fingerprint":  f.fingerprint,
    }


def build_json(report: ScanReport, details: dict | None = None) -> dict:
    """Turn a ScanReport into a plain dict ready for json.dumps().

    Args:
        details: extra top-level fields, e.g. repository/branch/commit
                 for GitHub scans.
    """
    root = Path(report.repo_path).resolve()
    data = {
        "schema_version": SCHEMA_VERSION,
        "status": "ok",
        "scanned_path": str(root),
    }
    data.update(details or {})
    data["summary"] = report.summary
    data["total"] = report.total
    data["scanners"] = [
        {"name": r.scanner_name, "ok": r.success, "error": r.error or None}
        for r in report.scanner_results
    ]
    data["findings"] = [finding_to_dict(f, root) for f in report.findings]
    return data


def error_json(message: str, error_type: str = "error") -> dict:
    """The JSON printed when the scan could not run at all."""
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "error",
        "error_type": error_type,     # e.g. "GitHubAuthError", "RepoSelectionError"
        "message": message,
    }


def dumps(data: dict) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False)