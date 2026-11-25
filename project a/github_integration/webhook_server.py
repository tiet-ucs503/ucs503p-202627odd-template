# github_integration/webhook_server.py
#
# ThreatLens GitHub Webhook Server (Stage 4 / Stage 5).
# Receives GitHub webhook events for pull requests, verifies HMAC signatures,
# executes scan_github_repo(), and posts/updates PR review comments.

import hashlib
import hmac
import json
import logging
import os
import sys
from typing import Any, Dict, Optional, Tuple

from flask import Flask, Response, jsonify, request

from github_integration.pipeline import scan_github_repo
from github_integration.pr_commenter import format_pr_comment, post_or_update_pr_comment
from reporting.json_report import build_json

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("threatlens.webhook")

app = Flask(__name__)


def get_webhook_secret() -> str:
    """Read the webhook secret from environment."""
    return os.getenv("GITHUB_WEBHOOK_SECRET", "").strip()


def verify_signature(payload: bytes, signature_header: Optional[str], secret: str) -> bool:
    """Verify GitHub HMAC-SHA256 signature.

    Args:
        payload: Raw request body bytes.
        signature_header: The value of the X-Hub-Signature-256 header (e.g. 'sha256=...').
        secret: Configured webhook secret string.

    Returns:
        True if signature matches, False otherwise.
    """
    if not secret:
        # If no secret configured, log warning and allow for local testing
        logger.warning("GITHUB_WEBHOOK_SECRET is not set; skipping signature verification.")
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected_hash = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    received_hash = signature_header[len("sha256="):]

    return hmac.compare_digest(expected_hash, received_hash)


@app.route("/health", methods=["GET"])
def health_check() -> Tuple[Response, int]:
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "threatlens-webhook-receiver"}), 200


@app.route("/webhook", methods=["POST"])
def handle_webhook() -> Tuple[Response, int]:
    """Handle incoming GitHub webhook deliveries."""
    signature = request.headers.get("X-Hub-Signature-256")
    secret = get_webhook_secret()

    if secret and not verify_signature(request.data, signature, secret):
        logger.warning("Signature verification failed for incoming webhook.")
        return jsonify({"status": "error", "message": "Invalid HMAC signature"}), 401

    event_type = request.headers.get("X-GitHub-Event")
    if not event_type:
        return jsonify({"status": "error", "message": "Missing X-GitHub-Event header"}), 400

    logger.info("Received GitHub event: %s", event_type)

    try:
        payload: Dict[str, Any] = request.get_json(force=True)
    except Exception as exc:
        logger.error("Failed to parse JSON payload: %s", exc)
        return jsonify({"status": "error", "message": "Invalid JSON"}), 400

    if event_type == "ping":
        return jsonify({"status": "ok", "message": "Pong! ThreatLens webhook active."}), 200

    if event_type == "pull_request":
        action = payload.get("action")
        logger.info("Processing pull_request action: %s", action)

        if action in ("opened", "synchronize", "reopened"):
            pr_data = payload.get("pull_request", {})
            pr_number = pr_data.get("number")
            repo_data = payload.get("repository", {})
            repo_name = repo_data.get("full_name")
            head_branch = pr_data.get("head", {}).get("ref")

            if not repo_name or not pr_number:
                return jsonify({"status": "error", "message": "Incomplete PR data"}), 400

            logger.info("Triggering scan for PR #%d on repo '%s' (branch: %s)",
                        pr_number, repo_name, head_branch)

            try:
                # 1. Run pipeline scan
                scan_res = scan_github_repo(repo_name, branch=head_branch)
                report_dict = build_json(
                    scan_res.report,
                    details={
                        "scanned_path": f"github://{repo_name}/{head_branch}",
                        "repository": repo_name,
                        "branch": head_branch,
                        "commit": scan_res.commit_sha,
                    },
                )

                # 2. Format and post/update comment
                fail_on = os.getenv("THREATLENS_FAIL_ON", "HIGH")
                comment_md = format_pr_comment(report_dict, fail_on=fail_on)
                post_or_update_pr_comment(repo_name, pr_number, comment_md)

                return jsonify({
                    "status": "ok",
                    "repo": repo_name,
                    "pr": pr_number,
                    "total_findings": report_dict.get("total", 0),
                    "summary": report_dict.get("summary", {}),
                }), 200
            except Exception as exc:
                logger.error("Failed processing PR scan: %s", exc)
                return jsonify({"status": "error", "message": str(exc)}), 500

        return jsonify({"status": "ignored", "action": action}), 200

    return jsonify({"status": "ignored", "event": event_type}), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    logger.info("Starting ThreatLens Webhook Server on port %d...", port)
    app.run(host="0.0.0.0", port=port)
