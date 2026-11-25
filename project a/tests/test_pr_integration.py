# tests/test_pr_integration.py
#
# Unit tests for ThreatLens PR Commenter, Quality Gate, and Webhook Server.

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import pytest
from github_integration.pr_commenter import (
    COMMENT_MARKER,
    evaluate_quality_gate,
    format_pr_comment,
    post_or_update_pr_comment,
)
from github_integration.webhook_server import app, verify_signature


@pytest.fixture
def clean_scan_data():
    return {
        "status": "ok",
        "total": 0,
        "summary": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0},
        "scanners": [
            {"name": "Gitleaks", "ok": True, "error": None},
            {"name": "OSV-Scanner", "ok": True, "error": None},
            {"name": "Semgrep", "ok": True, "error": None},
        ],
        "findings": [],
    }


@pytest.fixture
def vulnerable_scan_data():
    return {
        "status": "ok",
        "total": 3,
        "summary": {"CRITICAL": 1, "HIGH": 1, "MEDIUM": 1, "LOW": 0, "INFO": 0},
        "scanners": [
            {"name": "Gitleaks", "ok": True, "error": None},
            {"name": "OSV-Scanner", "ok": True, "error": None},
            {"name": "Semgrep", "ok": True, "error": None},
        ],
        "findings": [
            {
                "file": "config.py",
                "line": 10,
                "severity": "CRITICAL",
                "tool": "Gitleaks",
                "rule": "aws-secret-access-key",
                "message": "AWS Secret Key leaked",
                "fix": "Remove secret from source code and revoke it.",
            },
            {
                "file": "server.py",
                "line": 45,
                "severity": "HIGH",
                "tool": "Semgrep",
                "rule": "python.flask.sqli",
                "message": "Unsanitized user input in query",
                "fix": "Use prepared statements.",
            },
            {
                "file": "requirements.txt",
                "line": None,
                "severity": "MEDIUM",
                "tool": "OSV-Scanner",
                "rule": "PYSEC-2023-100",
                "message": "Vulnerable dependency package",
                "fix": "Upgrade to package >= 2.0.0",
            },
        ],
    }


def test_evaluate_quality_gate_clean(clean_scan_data):
    assert evaluate_quality_gate(clean_scan_data, fail_on="HIGH") is True
    assert evaluate_quality_gate(clean_scan_data, fail_on="CRITICAL") is True
    assert evaluate_quality_gate(clean_scan_data, fail_on="LOW") is True


def test_evaluate_quality_gate_thresholds(vulnerable_scan_data):
    # Has CRITICAL and HIGH issues -> fails on CRITICAL or HIGH
    assert evaluate_quality_gate(vulnerable_scan_data, fail_on="CRITICAL") is False
    assert evaluate_quality_gate(vulnerable_scan_data, fail_on="HIGH") is False
    assert evaluate_quality_gate(vulnerable_scan_data, fail_on="MEDIUM") is False

    # NONE threshold always passes
    assert evaluate_quality_gate(vulnerable_scan_data, fail_on="NONE") is True


def test_format_pr_comment_clean(clean_scan_data):
    md = format_pr_comment(clean_scan_data, fail_on="HIGH")
    assert COMMENT_MARKER in md
    assert "Security Quality Gate: PASSED" in md
    assert "No security vulnerabilities" in md
    assert "| **0** | **0** | **0** | **0** | **0** | **0** |" in md


def test_format_pr_comment_vulnerable(vulnerable_scan_data):
    md = format_pr_comment(vulnerable_scan_data, fail_on="HIGH")
    assert COMMENT_MARKER in md
    assert "Security Quality Gate: FAILED" in md
    assert "AWS Secret Key leaked" in md
    assert "aws-secret-access-key" in md
    assert "Fix Suggestion" in md
    assert "config.py:10" in md
    assert "requirements.txt" in md


def test_post_or_update_pr_comment_creates_new():
    mock_gh = MagicMock()
    mock_repo = MagicMock()
    mock_pull = MagicMock()

    mock_gh.get_repo.return_value = mock_repo
    mock_repo.get_pull.return_value = mock_pull
    mock_pull.get_issue_comments.return_value = []

    res = post_or_update_pr_comment("owner/repo", 123, "test body", gh=mock_gh)
    assert res is True
    mock_pull.create_issue_comment.assert_called_once_with("test body")


def test_post_or_update_pr_comment_updates_existing():
    mock_gh = MagicMock()
    mock_repo = MagicMock()
    mock_pull = MagicMock()
    mock_existing = MagicMock()
    mock_existing.body = f"Previous text\n{COMMENT_MARKER}"

    mock_gh.get_repo.return_value = mock_repo
    mock_repo.get_pull.return_value = mock_pull
    mock_pull.get_issue_comments.return_value = [mock_existing]

    res = post_or_update_pr_comment("owner/repo", 123, "new body", gh=mock_gh)
    assert res is True
    mock_existing.edit.assert_called_once_with("new body")
    mock_pull.create_issue_comment.assert_not_called()


def test_webhook_verify_signature():
    secret = "my_super_secret"
    payload = b'{"action": "ping"}'
    valid_sig = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    assert verify_signature(payload, valid_sig, secret) is True
    assert verify_signature(payload, "sha256=invalidhash", secret) is False
    assert verify_signature(payload, "invalid_format", secret) is False


def test_webhook_health():
    client = app.test_client()
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json["status"] == "ok"


def test_webhook_ping():
    client = app.test_client()
    resp = client.post("/webhook", headers={"X-GitHub-Event": "ping"}, json={"zen": "Keep it logically awesome."})
    assert resp.status_code == 200
    assert "Pong" in resp.json["message"]


@patch("github_integration.webhook_server.post_or_update_pr_comment")
@patch("github_integration.webhook_server.scan_github_repo")
def test_webhook_pull_request_flow(mock_scan, mock_comment):
    from engine.security_engine import ScanReport
    from github_integration.pipeline import GitHubScanResult
    from github_integration.repos import RepoInfo

    mock_scan.return_value = GitHubScanResult(
        repo=RepoInfo(
            full_name="org/test-repo",
            private=False,
            default_branch="main",
            size_kb=100,
            language="Python",
            clone_url="https://github.com/org/test-repo.git",
        ),
        branch="feature-branch",
        commit_sha="a" * 40,
        report=ScanReport(repo_path=".", scanner_results=[], findings=[]),
        skipped_dirs=[],
    )

    client = app.test_client()
    payload = {
        "action": "opened",
        "pull_request": {
            "number": 42,
            "head": {"ref": "feature-branch"},
        },
        "repository": {
            "full_name": "org/test-repo",
        },
    }

    resp = client.post(
        "/webhook",
        headers={"X-GitHub-Event": "pull_request"},
        json=payload,
    )

    assert resp.status_code == 200
    assert resp.json["status"] == "ok"
    assert resp.json["pr"] == 42
    mock_scan.assert_called_once_with("org/test-repo", branch="feature-branch")
    mock_comment.assert_called_once()
