# github_integration/pipeline.py
#
# Stage 4 - Step 8: the whole GitHub scan in ONE function.
#
#     result = scan_github_repo("owner/repo", branch="dev")
#
# login -> select repo -> clone -> remove junk -> scan -> fix paths
#       -> ALWAYS delete the clone -> return the result
#
# This is the hand-off to Stage 5. The webhook/PR-comment code should
# call scan_github_repo() and nothing else from Stage 4.
#
# Rules this function follows (so a server can use it safely):
#   - never asks the user anything (no input())
#   - never prints (it RETURNS data; the caller decides what to show)
#   - errors come out as clear exception types, listed below

from dataclasses import dataclass, field

from github import Github

from engine.security_engine import ScanReport
from github_integration.cleanup import temporary_clone
from github_integration.client import get_github_client, get_token, verify_connection
from github_integration.repo_scanner import scan_cloned_repo
from github_integration.repo_selector import select_repo
from github_integration.repos import RepoInfo

# Errors callers should catch (re-exported so Stage 5 imports them from one place):
from github_integration.client import GitHubAuthError            # noqa: F401  bad/missing token
from github_integration.repo_selector import RepoSelectionError  # noqa: F401  bad name / not found / too big
from github_integration.cloner import CloneError                 # noqa: F401  branch missing / git failed

GITHUB_SCAN_ERRORS = (GitHubAuthError, RepoSelectionError, CloneError)


@dataclass
class GitHubScanResult:
    """Everything a caller needs after scanning a GitHub repo."""
    repo: RepoInfo                 # name, default branch, size, ...
    branch: str                    # branch that was scanned
    commit_sha: str                # exact commit that was scanned (40 chars)
    report: ScanReport             # findings, with repo-relative paths
    skipped_dirs: list[str] = field(default_factory=list)   # junk folders removed

    @property
    def short_sha(self) -> str:
        return self.commit_sha[:12]


def scan_github_repo(repo: str, branch: str | None = None,
                     gh: Github | None = None, token: str | None = None) -> GitHubScanResult:
    """Scan one branch of a GitHub repository.

    Args:
        repo:   "owner/repo" or any GitHub URL form select_repo() accepts.
        branch: branch to scan. None = the repo's default branch.
        gh:     an existing GitHub client (optional - created if not given).
        token:  GitHub token for cloning (optional - read from .env if not given).

    Returns:
        GitHubScanResult. The temporary clone is already deleted.

    Raises:
        GitHubAuthError, RepoSelectionError, CloneError  (see GITHUB_SCAN_ERRORS)
    """
    if gh is None:
        gh = get_github_client()
        verify_connection(gh)
    if token is None:
        token = get_token()

    info = select_repo(gh, repo)

    with temporary_clone(info, token=token, ref=branch) as cloned:
        report, skipped = scan_cloned_repo(cloned)
        result = GitHubScanResult(
            repo=info,
            branch=cloned.ref,
            commit_sha=cloned.commit_sha,
            report=report,
            skipped_dirs=skipped,
        )
    # <- clone deleted here, whatever happened inside the block

    return result