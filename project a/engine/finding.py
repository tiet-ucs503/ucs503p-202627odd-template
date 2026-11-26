
from dataclasses import dataclass
from enum import Enum


# Severity Scale
#
# CRITICAL  – production secret exposed, CVSS >= 9.0
# HIGH      – API key, access token, CVSS 7.0-8.9
# MEDIUM    – generic credential pattern, CVSS 4.0-6.9
# LOW       – informational code smell, CVSS < 4.0
# INFO      – best-practice suggestion, no immediate risk

class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH     = "HIGH"
    MEDIUM   = "MEDIUM"
    LOW      = "LOW"
    INFO     = "INFO"

    def __str__(self) -> str:
        return self.value


@dataclass
class Finding:
    tool: str = ""          # "Gitleaks" | "OSV-Scanner" | "Semgrep"
    rule: str = ""          # e.g. "github-pat", "CVE-2021-12345"
    category: str = ""      # "Secret" | "Dependency Vulnerability" | "Code Security"
    severity: Severity = Severity.MEDIUM

    file: str = ""          # Relative path, e.g. "app.py"
    start_line: int = 0
    end_line: int = 0
    start_column: int = 0
    end_column: int = 0

    description: str = ""   # What is wrong?
    risk: str = ""          # Why is it dangerous?
    recommendation: str = ""# How should it be fixed?

    reference: str = ""     # CVE link, rule documentation URL
    fingerprint: str = ""   # Unique identifier for deduplication

    def to_dict(self) -> dict:
        """Return the Finding as a plain Python dictionary."""
        return {
            "tool":           self.tool,
            "rule":           self.rule,
            "category":       self.category,
            "severity":       str(self.severity),
            "file":           self.file,
            "start_line":     self.start_line,
            "end_line":       self.end_line,
            "start_column":   self.start_column,
            "end_column":     self.end_column,
            "description":    self.description,
            "risk":           self.risk,
            "recommendation": self.recommendation,
            "reference":      self.reference,
            "fingerprint":    self.fingerprint,
        }

    def __repr__(self) -> str:
        return (
            f"Finding(tool={self.tool!r}, rule={self.rule!r}, "
            f"severity={self.severity}, file={self.file!r}, "
            f"line={self.start_line})"
        )
