# tests/test_scanners_and_cleanup.py
#
# Tests for the stale-clone cleanup, the Gitleaks exit-code handling and the
# OSV fingerprint / path fixes. No real scanners or network are needed.

import os
import subprocess
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from github_integration import cleanup
from scanners.gitleaks_scanner import GitleaksScanner
from scanners.osv_scanner import OsvScanner


# ── Stale clone cleanup ──────────────────────────────────────────

def _make_old(path: Path) -> None:
    old = time.time() - 3 * 24 * 3600
    os.utime(path, (old, old))


@pytest.fixture
def clone_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(cleanup, "get_clone_dir", lambda: tmp_path)
    return tmp_path


def test_cleanup_removes_only_real_old_clones(clone_dir):
    real = clone_dir / "QuantumWizardz__ThreatLens__k3j9x1ab"
    (real / ".git").mkdir(parents=True)
    _make_old(real)

    died_early = clone_dir / "org__repo__abcd1234"       # empty: clone crashed before git wrote
    died_early.mkdir()
    _make_old(died_early)

    lookalike = clone_dir / "my__notes"                   # user's folder, wrong pattern
    lookalike.mkdir()
    (lookalike / "todo.txt").write_text("keep me")
    _make_old(lookalike)

    pattern_but_not_clone = clone_dir / "org__repo__zzzz9999"   # right name, but has user files
    pattern_but_not_clone.mkdir()
    (pattern_but_not_clone / "thesis.docx").write_text("keep me too")
    _make_old(pattern_but_not_clone)

    fresh = clone_dir / "org__repo__fresh123"             # a clone in use right now
    (fresh / ".git").mkdir(parents=True)

    removed = cleanup.cleanup_stale_clones()

    assert removed == 2
    assert not real.exists()
    assert not died_early.exists()
    assert lookalike.exists()
    assert pattern_but_not_clone.exists()
    assert fresh.exists()


# ── Gitleaks exit codes ──────────────────────────────────────────

def _fake_gitleaks(returncode, report_content=None):
    """Return a fake subprocess.run that behaves like Gitleaks."""
    def fake_run(cmd, **kwargs):
        if "version" in cmd:
            return subprocess.CompletedProcess(cmd, 0, "v8.18.4", "")
        if report_content is not None:
            Path(cmd[cmd.index("--report-path") + 1]).write_text(report_content, encoding="utf-8")
        fake_run.last_cmd = cmd
        return subprocess.CompletedProcess(cmd, returncode, "", "boom" if returncode == 1 else "")
    return fake_run


def test_gitleaks_error_exit_is_not_treated_as_clean(tmp_path):
    with patch("scanners.gitleaks_scanner.subprocess.run", _fake_gitleaks(1)):
        with pytest.raises(RuntimeError, match="unexpected code 1"):
            GitleaksScanner(gitleaks_cmd="gitleaks-test").scan(str(tmp_path))


def test_gitleaks_leaks_exit_code_parses_findings(tmp_path):
    report = ('[{"RuleID": "generic-api-key", "File": "%s", "StartLine": 2, "EndLine": 2,'
              ' "Secret": "abcd1234efgh", "Description": "key", "Fingerprint": "x"}]'
              % (tmp_path / "config.py").as_posix())
    fake = _fake_gitleaks(GitleaksScanner.LEAKS_EXIT_CODE, report)
    with patch("scanners.gitleaks_scanner.subprocess.run", fake):
        findings = GitleaksScanner(gitleaks_cmd="gitleaks-test").scan(str(tmp_path))
    assert len(findings) == 1
    assert "--exit-code" in fake.last_cmd


def test_gitleaks_leaks_but_empty_report_is_an_error(tmp_path):
    with patch("scanners.gitleaks_scanner.subprocess.run",
               _fake_gitleaks(GitleaksScanner.LEAKS_EXIT_CODE, "")):
        with pytest.raises(RuntimeError, match="empty"):
            GitleaksScanner(gitleaks_cmd="gitleaks-test").scan(str(tmp_path))


def test_gitleaks_no_git_flag_for_clones(tmp_path):
    (tmp_path / ".git").mkdir()
    fake = _fake_gitleaks(0, "[]")
    with patch("scanners.gitleaks_scanner.subprocess.run", fake):
        GitleaksScanner(gitleaks_cmd="gitleaks-test", no_git=True).scan(str(tmp_path))
    assert "--no-git" in fake.last_cmd

    fake = _fake_gitleaks(0, "[]")
    with patch("scanners.gitleaks_scanner.subprocess.run", fake):
        GitleaksScanner(gitleaks_cmd="gitleaks-test").scan(str(tmp_path))
    assert "--no-git" not in fake.last_cmd       # local repo: still scans git history


# ── OSV fingerprint and paths ────────────────────────────────────

def _osv_data(root: Path):
    pkg = {
        "package": {"name": "flask", "version": "0.12.2", "ecosystem": "PyPI"},
        "vulnerabilities": [{"id": "GHSA-xxxx", "summary": "bad"}],
        "groups": [{"ids": ["GHSA-xxxx"], "aliases": ["CVE-2018-1000656"], "max_severity": "7.5"}],
    }
    return {"results": [
        {"source": {"path": str(root / "a" / "requirements.txt")}, "packages": [pkg]},
        {"source": {"path": str(root / "b" / "requirements.txt")}, "packages": [pkg]},
    ]}


def test_osv_same_vuln_in_two_manifests_stays_two_findings(tmp_path):
    scanner = OsvScanner.__new__(OsvScanner)      # skip binary detection
    findings = scanner._parse_results(_osv_data(tmp_path), tmp_path)
    assert len(findings) == 2
    assert findings[0].fingerprint != findings[1].fingerprint
    assert {f.file for f in findings} == {"a/requirements.txt", "b/requirements.txt"}
