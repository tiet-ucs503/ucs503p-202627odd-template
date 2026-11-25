# github_integration/repos.py
#
# Stage 4 - Phase 14: Find and select GitHub repositories.
#
# Step 3: list the repositories the token can see.
# (Step 4 will add "select one repo" to this same file.)

from dataclasses import dataclass
from itertools import islice

from github import Github
from github.Repository import Repository


@dataclass
class RepoInfo:
    """The few facts about a repo that ThreatLens actually needs.

    We copy them out of PyGithub's big Repository object so the rest
    of ThreatLens never depends on PyGithub directly.
    """
    full_name: str        # "owner/repo", e.g. "yazzzti23/my-project"
    private: bool         # True = private repo
    default_branch: str   # usually "main" or "master"
    size_kb: int          # approximate repo size reported by GitHub
    language: str         # main language GitHub detected ("" if none)
    clone_url: str        # https URL used later by `git clone`

    @classmethod
    def from_github(cls, repo: Repository) -> "RepoInfo":
        """Build a RepoInfo from a PyGithub Repository object."""
        return cls(
            full_name=repo.full_name,
            private=repo.private,
            default_branch=repo.default_branch,
            size_kb=repo.size,
            language=repo.language or "",
            clone_url=repo.clone_url,
        )


def list_repos(gh: Github, limit: int = 50) -> list[RepoInfo]:
    """Return up to `limit` repos the token can access, newest activity first.

    GitHub returns results in pages (30 per page by default). PyGithub's
    PaginatedList fetches the next page automatically only when we loop
    far enough - islice() stops after `limit` items so we never download
    more pages than we need (each page = 1 API call).
    """
    repos = gh.get_user().get_repos(sort="updated")
    return [RepoInfo.from_github(r) for r in islice(repos, limit)]


# Run directly to test:
#     python -m github_integration.repos
if __name__ == "__main__":
    from github_integration.client import (
        GitHubAuthError,
        get_github_client,
        verify_connection,
    )

    try:
        gh = get_github_client()
        user = verify_connection(gh)
    except GitHubAuthError as err:
        print(f"[FAILED] {err}")
        raise SystemExit(1)

    repos = list_repos(gh)
    print(f"[OK] {user} can see {len(repos)} repo(s):\n")
    print(f"  {'REPOSITORY':<45} {'VISIBILITY':<10} {'BRANCH':<10} {'SIZE':>8}  LANGUAGE")
    print(f"  {'-' * 45} {'-' * 10} {'-' * 10} {'-' * 8}  {'-' * 10}")
    for r in repos:
        vis = "private" if r.private else "public"
        print(f"  {r.full_name:<45} {vis:<10} {r.default_branch:<10} {r.size_kb:>6}KB  {r.language}")