# github_integration/client.py
#
# Stage 4 - Phase 13: Connect ThreatLens to GitHub.
#
# This module is the ONLY place in ThreatLens that knows how we log in
# to GitHub. Everything else (listing repos, cloning, Stage 5 webhooks
# and PR comments) just calls get_github_client() and gets back a ready,
# authenticated client.
#
# Today we log in with a fine-grained Personal Access Token (PAT) read
# from the GITHUB_TOKEN environment variable / .env file. If Stage 5
# later switches to a GitHub App, only this file needs to change.

import os
from pathlib import Path

from dotenv import load_dotenv
from github import Auth, Github
from github.GithubException import BadCredentialsException, GithubException

# project a/  (this file is project a/github_integration/client.py)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Read project a/.env into environment variables (if the file exists).
# Real environment variables win over .env values (override=False), which
# is what CI / servers expect.
load_dotenv(PROJECT_ROOT / ".env", override=False)


class GitHubAuthError(RuntimeError):
    """Raised when ThreatLens cannot authenticate with GitHub."""


def get_token() -> str:
    """Return the GitHub token, or raise a clear error if it is missing."""
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token:
        raise GitHubAuthError(
            "GITHUB_TOKEN is not set. Create a fine-grained token on GitHub "
            "and add a line 'GITHUB_TOKEN=github_pat_...' to project a/.env"
        )
    return token


def get_github_client() -> Github:
    """Create an authenticated PyGithub client.

    Note: creating the client does NOT contact GitHub yet. PyGithub is
    lazy - the first real API call is what actually checks the token.
    That is why verify_connection() exists.
    """
    return Github(auth=Auth.Token(get_token()), timeout=30)


def verify_connection(gh: Github) -> str:
    """Make one cheap API call to prove the token works.

    Returns:
        The GitHub username the token belongs to.

    Raises:
        GitHubAuthError: if the token is wrong, expired or revoked.
    """
    try:
        return gh.get_user().login
    except BadCredentialsException as exc:
        raise GitHubAuthError(
            "GitHub rejected the token (401 Bad credentials). It may be "
            "mistyped, expired or revoked - generate a new one."
        ) from exc
    except GithubException as exc:
        raise GitHubAuthError(f"GitHub API error {exc.status}: {exc.data}") from exc


# Run directly to test the connection:
#     python -m github_integration.client
if __name__ == "__main__":
    try:
        gh = get_github_client()
        username = verify_connection(gh)
    except GitHubAuthError as err:
        print(f"[FAILED] {err}")
        raise SystemExit(1)

    rate = gh.get_rate_limit().core
    print(f"[OK] Connected to GitHub as: {username}")
    print(f"     API calls left this hour: {rate.remaining}/{rate.limit}")