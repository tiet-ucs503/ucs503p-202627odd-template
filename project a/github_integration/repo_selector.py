# github_integration/repo_selector.py
#
# Stage 4 - Phase 14 (Step 4): Select ONE repository and check it.
#
# Takes whatever the user typed ("owner/repo", a GitHub URL, ...),
# turns it into a clean "owner/repo", asks GitHub for that repo and
# checks that ThreatLens can actually scan it.

import re

from github import Github
from github.GithubException import GithubException, UnknownObjectException

from github_integration.repos import RepoInfo

# Repos bigger than this are refused - cloning and scanning them would be
# too slow for an interactive tool. GitHub reports size in KB.
MAX_REPO_SIZE_KB = 500 * 1024   # 500 MB

# GitHub owner names: letters, digits, hyphens (max 39 chars).
# Repo names: letters, digits, '.', '_', '-'.
_FULL_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$")

_GITHUB_PREFIXES = (
    "https://github.com/",
    "http://github.com/",
    "github.com/",
    "git@github.com:",
)


class RepoSelectionError(ValueError):
    """Raised when the requested repo is invalid, missing or not scannable."""


def parse_full_name(user_input: str) -> str:
    """Normalise whatever the user typed into 'owner/repo'.

    Accepts:
        owner/repo
        https://github.com/owner/repo
        https://github.com/owner/repo.git
        https://github.com/owner/repo/tree/main/some/folder
        git@github.com:owner/repo.git

    Raises:
        RepoSelectionError: if it does not look like a GitHub repo.
    """
    text = user_input.strip()

    # 1. Remove a GitHub prefix, if there is one, and keep only owner/repo
    #    (drops extra parts like /tree/main/some/folder).
    for prefix in _GITHUB_PREFIXES:
        if text.lower().startswith(prefix):
            text = text[len(prefix):]
            text = "/".join(text.split("/")[:2])
            break

    # 2. Remove a trailing "/" and ".git".
    text = text.rstrip("/")
    if text.endswith(".git"):
        text = text[:-4]

    # 3. Whatever is left must look exactly like owner/repo.
    if not _FULL_NAME_RE.match(text):
        raise RepoSelectionError(
            f"'{user_input}' is not a valid GitHub repository. "
            "Use the form owner/repo, e.g. yazzzti23/my-project"
        )
    return text


def select_repo(gh: Github, user_input: str) -> RepoInfo:
    """Look up ONE repo and check that ThreatLens can scan it.

    Raises:
        RepoSelectionError: bad name, repo not found / no access,
                            empty repo, or repo too large.
    """
    full_name = parse_full_name(user_input)

    # Ask GitHub for the repo (1 API call).
    try:
        repo = gh.get_repo(full_name)
        info = RepoInfo.from_github(repo)
    except UnknownObjectException as exc:
        # GitHub answers 404 for BOTH "does not exist" and "private and
        # you have no access" - on purpose, so outsiders cannot discover
        # private repo names. So we cannot tell which one it is.
        raise RepoSelectionError(
            f"Repository '{full_name}' was not found, or your token "
            "does not have access to it."
        ) from exc
    except GithubException as exc:
        raise RepoSelectionError(
            f"GitHub API error {exc.status} while opening '{full_name}': {exc.data}"
        ) from exc

    # Guardrails: refuse repos we cannot or should not scan.
    if info.size_kb == 0:
        raise RepoSelectionError(f"Repository '{full_name}' is empty - nothing to scan.")

    if info.size_kb > MAX_REPO_SIZE_KB:
        raise RepoSelectionError(
            f"Repository '{full_name}' is {info.size_kb // 1024} MB; "
            f"ThreatLens only scans repos up to {MAX_REPO_SIZE_KB // 1024} MB."
        )

    return info


# Run directly to test:
#     python -m github_integration.repo_selector owner/repo
if __name__ == "__main__":
    import sys

    from github_integration.client import (
        GitHubAuthError,
        get_github_client,
        verify_connection,
    )

    if len(sys.argv) != 2:
        print("Usage: python -m github_integration.repo_selector owner/repo")
        raise SystemExit(2)

    try:
        gh = get_github_client()
        verify_connection(gh)
        info = select_repo(gh, sys.argv[1])
    except (GitHubAuthError, RepoSelectionError) as err:
        print(f"[FAILED] {err}")
        raise SystemExit(1)

    print("[OK] Repository selected:\n")
    print(f"  Name           : {info.full_name}")
    print(f"  Visibility     : {'private' if info.private else 'public'}")
    print(f"  Default branch : {info.default_branch}")
    print(f"  Size           : {info.size_kb} KB")
    print(f"  Language       : {info.language or '-'}")
    print(f"  Clone URL      : {info.clone_url}")