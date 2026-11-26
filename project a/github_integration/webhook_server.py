# github_integration/webhook_server.py
#
# ThreatLens GitHub Webhook Server (Stage 5).
# Receives GitHub webhook events for pull requests, verifies HMAC signatures,
# runs scan_github_repo() in the background, and posts/updates a PR comment.
#
# Security:
#   - Every request must carry a valid X-Hub-Signature-256 made with
#     GITHUB_WEBHOOK_SECRET. Without a secret, requests are REJECTED,
#     unless THREATLENS_ALLOW_UNSIGNED=1 is set (local testing only).
#
# Timing:
#   - GitHub waits only ~10 seconds for a reply, but a scan takes much
#     longer. So we reply "202 Accepted" straight away and do the scan +
#     PR comment in a background thread.
#
# Forks:
#   - A PR's code lives in the HEAD repository (the fork), not in the base
#     repository. We clone head.repo at head.ref, and post the comment on
#     the base repository's PR.

import hashlib
import hmac
import logging
import os
import threading
from typing import Any, Callable, Dict, Optional, Tuple

from flask import Flask, Response, jsonify, request

from github_integration.pipeline import scan_github_repo
from github_integration.pr_commenter import format_pr_comment, post_or_update_pr_comment
from reporting.json_report import build_json, error_json

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("threatlens.webhook")

app = Flask(__name__)

PR_ACTIONS = ("opened", "synchronize", "reopened")


def get_webhook_secret() -> str:
    """Read the webhook secret from environment."""
    return os.getenv("GITHUB_WEBHOOK_SECRET", "").strip()


def unsigned_allowed() -> bool:
    """True only when the developer explicitly allowed unsigned requests."""
    return os.getenv("THREATLENS_ALLOW_UNSIGNED", "").strip() == "1"


def verify_signature(payload: bytes, signature_header: Optional[str], secret: str) -> bool:
    """Verify GitHub HMAC-SHA256 signature.

    Args:
        payload: Raw request body bytes.
        signature_header: The value of the X-Hub-Signature-256 header (e.g. 'sha256=...').
        secret: Configured webhook secret string. Empty = always False.

    Returns:
        True if signature matches, False otherwise.
    """
    if not secret:
        return False
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected_hash = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    received_hash = signature_header[len("sha256="):]
    return hmac.compare_digest(expected_hash, received_hash)


def is_request_authorized(payload: bytes, signature_header: Optional[str]) -> bool:
    """Apply the signature policy described at the top of this file."""
    secret = get_webhook_secret()
    if secret:
        return verify_signature(payload, signature_header, secret)
    if unsigned_allowed():
        logger.warning("GITHUB_WEBHOOK_SECRET is not set and THREATLENS_ALLOW_UNSIGNED=1: "
                       "accepting an UNSIGNED request (local testing only).")
        return True
    logger.error("GITHUB_WEBHOOK_SECRET is not set; rejecting request. "
                 "Set the secret, or THREATLENS_ALLOW_UNSIGNED=1 for local testing.")
    return False


def extract_pr_target(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Pull out what we need to scan a PR and comment on it.

    Returns None if the payload is missing something essential.
      base_repo: where the PR lives (where we comment)
      head_repo: where the PR's code lives (what we clone) - the fork for fork PRs
      head_ref:  the PR's branch in head_repo
      head_sha:  the commit GitHub says the PR is at
    """
    pr = payload.get("pull_request") or {}
    head = pr.get("head") or {}
    base_repo = (payload.get("repository") or {}).get("full_name")
    head_repo = (head.get("repo") or {}).get("full_name")
    pr_number = pr.get("number")
    head_ref = head.get("ref")

    if not base_repo or not pr_number or not head_ref:
        return None
    if not head_repo:
        # The fork was deleted, or an old/minimal payload.
        # Only safe to fall back to the base repo if this is clearly NOT a fork PR.
        if "repo" in head:
            return None
        head_repo = base_repo

    return {
        "base_repo": base_repo,
        "head_repo": head_repo,
        "head_ref": head_ref,
        "head_sha": head.get("sha"),
        "pr_number": int(pr_number),
    }


def run_pr_scan(target: Dict[str, Any]) -> None:
    """Scan the PR's code and post/update the ThreatLens comment.

    Runs in a background thread, so it must never raise: every failure is
    logged, and we try to tell the PR author with a comment.
    """
    base_repo = target["base_repo"]
    pr_number = target["pr_number"]
    fail_on = os.getenv("THREATLENS_FAIL_ON", "HIGH")
    try:
        scan_res = scan_github_repo(target["head_repo"], branch=target["head_ref"])
        if target.get("head_sha") and scan_res.commit_sha and scan_res.commit_sha != target["head_sha"]:
            logger.info("PR #%d moved on while queued (expected %s, scanned %s); "
                        "the next 'synchronize' event will rescan.",
                        pr_number, target["head_sha"][:7], scan_res.commit_sha[:7])
        report_dict = build_json(
            scan_res.report,
            details={
                "scanned_path": f"github://{target['head_repo']}/{target['head_ref']}",
                "repository": target["head_repo"],
                "branch": target["head_ref"],
                "commit": scan_res.commit_sha,
            },
        )
    except Exception as exc:  # noqa: BLE001 - background thread, report everything
        logger.error("Scan failed for PR #%d on %s: %s", pr_number, base_repo, exc)
        report_dict = error_json(f"ThreatLens could not scan this PR: {exc}", type(exc).__name__)

    try:
        comment_md = format_pr_comment(report_dict, fail_on=fail_on)
        post_or_update_pr_comment(base_repo, pr_number, comment_md)
        logger.info("Finished PR #%d on %s (%s findings)",
                    pr_number, base_repo, report_dict.get("total", "n/a"))
    except Exception as exc:  # noqa: BLE001
        logger.error("Could not comment on PR #%d on %s: %s", pr_number, base_repo, exc)


def start_background(func: Callable[..., None], *args: Any) -> None:
    """Run func(*args) in a daemon thread. Tests replace this to run inline."""
    threading.Thread(target=func, args=args, daemon=True, name="threatlens-pr-scan").start()


@app.route("/health", methods=["GET"])
def health_check() -> Tuple[Response, int]:
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "threatlens-webhook-receiver"}), 200


@app.route("/webhook", methods=["POST"])
def handle_webhook() -> Tuple[Response, int]:
    """Handle incoming GitHub webhook deliveries."""
    if not is_request_authorized(request.get_data(), request.headers.get("X-Hub-Signature-256")):
        return jsonify({"status": "error", "message": "Invalid or missing HMAC signature"}), 401

    event_type = request.headers.get("X-GitHub-Event")
    if not event_type:
        return jsonify({"status": "error", "message": "Missing X-GitHub-Event header"}), 400

    logger.info("Received GitHub event: %s", event_type)

    payload = request.get_json(force=True, silent=True)
    if not isinstance(payload, dict):
        return jsonify({"status": "error", "message": "Invalid JSON"}), 400

    if event_type == "ping":
        return jsonify({"status": "ok", "message": "Pong! ThreatLens webhook active."}), 200

    if event_type != "pull_request":
        return jsonify({"status": "ignored", "event": event_type}), 200

    action = payload.get("action")
    if action not in PR_ACTIONS:
        return jsonify({"status": "ignored", "action": action}), 200

    target = extract_pr_target(payload)
    if target is None:
        return jsonify({"status": "error", "message": "Incomplete PR data"}), 400

    logger.info("Queueing scan for PR #%d on %s (code: %s @ %s)",
                target["pr_number"], target["base_repo"], target["head_repo"], target["head_ref"])
    start_background(run_pr_scan, target)

    return jsonify({
        "status": "accepted",
        "repo": target["base_repo"],
        "pr": target["pr_number"],
        "scanning": f"{target['head_repo']}@{target['head_ref']}",
    }), 202


if __name__ == "__main__":
    if not get_webhook_secret() and not unsigned_allowed():
        raise SystemExit("Set GITHUB_WEBHOOK_SECRET (or THREATLENS_ALLOW_UNSIGNED=1 for local testing).")
    port = int(os.getenv("PORT", "5000"))
    logger.info("Starting ThreatLens Webhook Server on port %d...", port)
    app.run(host="0.0.0.0", port=port)
