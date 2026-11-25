# github_integration/branches.py
#
# Stage 4 - Phase 14: Find the branches of the selected repo and let
# the user pick which one to scan.
#
#   list_branches()     - ask GitHub which branches exist   (library code)
#   prompt_for_branch() - ask the PERSON which one they want (CLI only)
#
# Keep these two separate: Stage 5 (webhooks) also needs list_branches(),
# but a webhook runs on a server with nobody at the keyboard - it must
# NEVER call prompt_for_branch(). It gets the branch from the PR instead.

from itertools import islice

from github import Github
from github.GithubException import GithubException

from github_integration.repos import RepoInfo


class BranchError(RuntimeError):
    """Raised when the branch list cannot be fetched."""


def list_branches(gh: Github, repo: RepoInfo, limit: int = 100) -> list[str]:
    """Return branch names, default branch first, the rest A-Z.

    Like list_repos(), GitHub sends branches in pages; islice() stops
    after `limit` names so a repo with 5,000 branches can't eat our
    API budget.
    """
    try:
        names = [b.name for b in islice(gh.get_repo(repo.full_name).get_branches(), limit)]
    except GithubException as exc:
        raise BranchError(
            f"Could not list branches of {repo.full_name}: GitHub API error {exc.status}"
        ) from exc

    others = sorted(n for n in names if n != repo.default_branch)
    return [repo.default_branch] + others


def prompt_for_branch(branches: list[str], default: str) -> str:
    """Show a numbered menu and return the branch the user picks.

    Accepts a number, a branch name, or just Enter (= default branch).
    Keeps asking until the answer is valid.
    """
    print(f"\nThis repo has {len(branches)} branches:\n")
    for i, name in enumerate(branches, start=1):
        tag = "  (default)" if name == default else ""
        print(f"  [{i}] {name}{tag}")

    while True:
        answer = input(f"\nWhich branch should be scanned? [Enter = {default}]: ").strip()

        if answer == "":
            return default
        if answer.isdigit() and 1 <= int(answer) <= len(branches):
            return branches[int(answer) - 1]
        if answer in branches:
            return answer

        print(f"  '{answer}' is not in the list - type a number from 1 to {len(branches)}, or a branch name.")


# Run directly to test:
#     python -m github_integration.branches owner/repo
if __name__ == "__main__":
    import sys

    from github_integration.client import GitHubAuthError, get_github_client, verify_connection
    from github_integration.repo_selector import RepoSelectionError, select_repo

    if len(sys.argv) != 2:
        print("Usage: python -m github_integration.branches owner/repo")
        raise SystemExit(2)

    try:
        gh = get_github_client()
        verify_connection(gh)
        info = select_repo(gh, sys.argv[1])
        branches = list_branches(gh, info)
    except (GitHubAuthError, RepoSelectionError, BranchError) as err:
        print(f"[FAILED] {err}")
        raise SystemExit(1)

    print(f"[OK] {info.full_name} has {len(branches)} branch(es):")
    for name in branches:
        print(f"  - {name}{'  (default)' if name == info.default_branch else ''}")