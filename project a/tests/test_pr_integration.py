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


def _signed_post(client, event, payload, secret="test-secret"):
    body = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post("/webhook", data=body, content_type="application/json",
                       headers={"X-GitHub-Event": event, "X-Hub-Signature-256": sig})


@pytest.fixture
def webhook_env(monkeypatch):
    """Secret set, and background work runs inline so tests can assert on it."""
    import github_integration.webhook_server as ws
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "test-secret")
    monkeypatch.delenv("THREATLENS_ALLOW_UNSIGNED", raising=False)
    monkeypatch.setattr(ws, "start_background", lambda func, *args: func(*args))
    return ws


def _fake_scan_result(full_name="org/test-repo", branch="feature-branch"):
    from engine.security_engine import ScanReport
    from github_integration.pipeline import GitHubScanResult
    from github_integration.repos import RepoInfo
    return GitHubScanResult(
        repo=RepoInfo(full_name=full_name, private=False, default_branch="main", size_kb=100,
                      language="Python", clone_url=f"https://github.com/{full_name}.git"),
        branch=branch,
        commit_sha="a" * 40,
        report=ScanReport(repo_path=".", scanner_results=[], findings=[]),
        skipped_dirs=[],
    )


def test_webhook_verify_signature():
    secret = "my_super_secret"
    payload = b'{"action": "ping"}'
    valid_sig = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    assert verify_signature(payload, valid_sig, secret) is True
    assert verify_signature(payload, "sha256=invalidhash", secret) is False
    assert verify_signature(payload, "invalid_format", secret) is False
    assert verify_signature(payload, valid_sig, "") is False


def test_webhook_health():
    client = app.test_client()
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json["status"] == "ok"


def test_webhook_ping(webhook_env):
    resp = _signed_post(app.test_client(), "ping", {"zen": "Keep it logically awesome."})
    assert resp.status_code == 200
    assert "Pong" in resp.json["message"]


def test_webhook_rejects_bad_signature(webhook_env):
    resp = _signed_post(app.test_client(), "ping", {"zen": "x"}, secret="wrong-secret")
    assert resp.status_code == 401


def test_webhook_rejects_unsigned_when_no_secret(monkeypatch):
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
    monkeypatch.delenv("THREATLENS_ALLOW_UNSIGNED", raising=False)
    resp = app.test_client().post("/webhook", headers={"X-GitHub-Event": "ping"}, json={})
    assert resp.status_code == 401


def test_webhook_allows_unsigned_with_dev_flag(monkeypatch):
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
    monkeypatch.setenv("THREATLENS_ALLOW_UNSIGNED", "1")
    resp = app.test_client().post("/webhook", headers={"X-GitHub-Event": "ping"}, json={})
    assert resp.status_code == 200


@patch("github_integration.webhook_server.post_or_update_pr_comment")
@patch("github_integration.webhook_server.scan_github_repo")
def test_webhook_pull_request_flow(mock_scan, mock_comment, webhook_env):
    mock_scan.return_value = _fake_scan_result()
    payload = {
        "action": "opened",
        "pull_request": {
            "number": 42,
            "head": {"ref": "feature-branch", "sha": "a" * 40,
                     "repo": {"full_name": "org/test-repo"}},
        },
        "repository": {"full_name": "org/test-repo"},
    }

    resp = _signed_post(app.test_client(), "pull_request", payload)

    assert resp.status_code == 202
    assert resp.json["status"] == "accepted"
    assert resp.json["pr"] == 42
    mock_scan.assert_called_once_with("org/test-repo", branch="feature-branch")
    mock_comment.assert_called_once()
    assert mock_comment.call_args[0][:2] == ("org/test-repo", 42)


@patch("github_integration.webhook_server.post_or_update_pr_comment")
@patch("github_integration.webhook_server.scan_github_repo")
def test_webhook_fork_pr_scans_fork_and_comments_on_base(mock_scan, mock_comment, webhook_env):
    mock_scan.return_value = _fake_scan_result("contributor/test-repo", "main")
    payload = {
        "action": "synchronize",
        "pull_request": {
            "number": 7,
            "head": {"ref": "main", "sha": "a" * 40,
                     "repo": {"full_name": "contributor/test-repo"}},
        },
        "repository": {"full_name": "org/test-repo"},
    }

    resp = _signed_post(app.test_client(), "pull_request", payload)

    assert resp.status_code == 202
    mock_scan.assert_called_once_with("contributor/test-repo", branch="main")
    assert mock_comment.call_args[0][:2] == ("org/test-repo", 7)


@patch("github_integration.webhook_server.post_or_update_pr_comment")
@patch("github_integration.webhook_server.scan_github_repo")
def test_webhook_scan_error_still_comments(mock_scan, mock_comment, webhook_env):
    mock_scan.side_effect = RuntimeError("clone failed")
    payload = {
        "action": "opened",
        "pull_request": {"number": 3, "head": {"ref": "x", "repo": {"full_name": "org/r"}}},
        "repository": {"full_name": "org/r"},
    }

    resp = _signed_post(app.test_client(), "pull_request", payload)

    assert resp.status_code == 202
    body = mock_comment.call_args[0][2]
    assert "FAILED (scan incomplete)" in body
    assert "clone failed" in body


def test_webhook_deleted_fork_is_rejected(webhook_env):
    payload = {
        "action": "opened",
        "pull_request": {"number": 9, "head": {"ref": "main", "repo": None}},
        "repository": {"full_name": "org/r"},
    }
    resp = _signed_post(app.test_client(), "pull_request", payload)
    assert resp.status_code == 400
