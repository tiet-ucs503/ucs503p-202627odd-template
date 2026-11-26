# github_integration/cloner.py
#
# Stage 4 - Phase 15 (Step 5): Download (clone) a GitHub repository.
#
# Makes a fresh, temporary copy of ONE repo inside the clone folder
# so the SecurityEngine can scan it like any local folder.
#
# Clone folder = THREATLENS_CLONE_DIR from .env if set,
#                otherwise project a/tmp_repos/
#
#   - shallow clone (--depth 1): only the latest snapshot, no history
#   - token is sent in an HTTP header via environment variables,
#     never written into the URL, a file, or the command line
#   - each clone gets its own unique folder, so two scans never collide

import base64
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

# Importing client also loads .env, so THREATLENS_CLONE_DIR is available.
from github_integration.client import PROJECT_ROOT
from github_integration.repos import RepoInfo

DEFAULT_CLONE_DIR = PROJECT_ROOT / "tmp_repos"   # already in .gitignore

CLONE_TIMEOUT_SECONDS = 300                    # give up after 5 minutes


class CloneError(RuntimeError):
    """Raised when a repository cannot be cloned."""


def get_clone_dir() -> Path:
    """Folder where clones go.

    Read from the THREATLENS_CLONE_DIR setting (in .env) so each person
    can choose their own location without changing the code. Falls back
    to project a/tmp_repos/ if it is not set.
    """
    configured = os.getenv("THREATLENS_CLONE_DIR", "").strip()
    folder = Path(configured).expanduser() if configured else DEFAULT_CLONE_DIR
    folder.mkdir(parents=True, exist_ok=True)
    return folder.resolve()


@dataclass
class ClonedRepo:
    """Where the downloaded copy lives and exactly which version it is."""
    full_name: str     # "owner/repo"
    path: Path         # local folder, e.g. <clone dir>/owner__repo__a1b2c3
    ref: str           # branch that was cloned, e.g. "main"
    commit_sha: str    # exact commit scanned (Stage 5 needs this for PRs)


def _git_env(token: str | None) -> dict[str, str]:
    """Build the environment for the git process.

    GIT_TERMINAL_PROMPT=0 -> if auth fails, git errors out instead of
                             freezing while it waits for a password.
    GIT_CONFIG_COUNT/KEY/VALUE -> pass one config setting to git through
        environment variables (git 2.31+). We use it to add an
        "Authorization" header. Unlike putting the token in the URL,
        this is not saved in .git/config and not visible in the
        command line / task manager.
    """
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    if token:
        basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()
        env["GIT_CONFIG_COUNT"] = "1"
        env["GIT_CONFIG_KEY_0"] = "http.extraHeader"
        env["GIT_CONFIG_VALUE_0"] = f"Authorization: Basic {basic}"
    return env


def _redact(text: str, token: str | None) -> str:
    """Make sure the token never appears in an error message."""
    return text.replace(token, "***") if token else text


def clone_repo(repo: RepoInfo, token: str | None = None, ref: str | None = None) -> ClonedRepo:
    """Shallow-clone `repo` into a new folder inside get_clone_dir().

    Args:
        repo:  the repo picked in Step 4 (select_repo).
        token: GitHub token; needed for private repos. None = public only.
        ref:   branch to clone. None = the repo's default branch.

    Returns:
        ClonedRepo describing where the copy is.

    Raises:
        CloneError: git missing, auth failed, branch missing, timeout...
    """
    if shutil.which("git") is None:
        raise CloneError("git is not installed or not on PATH. Install it from https://git-scm.com")

    branch = ref or repo.default_branch

    # Unique folder per clone, e.g. <clone dir>/QuantumWizardz__ThreatLens__k3j9x1/
    prefix = repo.full_name.replace("/", "__") + "__"
    dest = Path(tempfile.mkdtemp(prefix=prefix, dir=get_clone_dir()))

    cmd = [
        "git", "clone",
        "--depth", "1",          # latest snapshot only - much faster
        "--single-branch",       # don't fetch other branches
        "--branch", branch,
        "--quiet",
        repo.clone_url,
        str(dest),
    ]

    try:
        result = subprocess.run(
            cmd,
            env=_git_env(token),
            capture_output=True,
            text=True,
            timeout=CLONE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        shutil.rmtree(dest, ignore_errors=True)   # Step 7 will make cleanup robust
        raise CloneError(
            f"Cloning {repo.full_name} took longer than {CLONE_TIMEOUT_SECONDS}s - gave up."
        ) from exc

    if result.returncode != 0:
        shutil.rmtree(dest, ignore_errors=True)
        stderr = result.stderr.lower()
        if "remote branch" in stderr and "not found" in stderr:
            raise CloneError(
                f"Branch '{branch}' does not exist in {repo.full_name}. "
                f"(The default branch is '{repo.default_branch}'.)"
            )
        raise CloneError(
            f"git clone failed for {repo.full_name} (branch '{branch}'):\n"
            f"{_redact(result.stderr.strip(), token)}"
        )

    # Record the exact commit we downloaded.
    sha = subprocess.run(
        ["git", "-C", str(dest), "rev-parse", "HEAD"],
        capture_output=True, text=True,
    ).stdout.strip()

    return ClonedRepo(full_name=repo.full_name, path=dest, ref=branch, commit_sha=sha)


# Run directly to test:
#     python -m github_integration.cloner owner/repo        -> shows branches, asks which one
#     python -m github_integration.cloner owner/repo dev    -> clones branch "dev" directly
if __name__ == "__main__":
    import sys
    import time

    from github_integration.client import (
        GitHubAuthError,
        get_github_client,
        get_token,
        verify_connection,
    )
    from github_integration.branches import BranchError, list_branches, prompt_for_branch
    from github_integration.repo_selector import RepoSelectionError, select_repo

    if len(sys.argv) not in (2, 3):
        print("Usage: python -m github_integration.cloner owner/repo [branch]")
        raise SystemExit(2)

    try:
        gh = get_github_client()
        verify_connection(gh)
        info = select_repo(gh, sys.argv[1])

        if len(sys.argv) == 3:
            branch = sys.argv[2]                      # user already named a branch
        else:
            branches = list_branches(gh, info)
            if len(branches) == 1:
                branch = branches[0]                  # only one - nothing to ask
            else:
                branch = prompt_for_branch(branches, info.default_branch)

        print(f"\nCloning {info.full_name} ({info.size_kb} KB, branch '{branch}')...")
        start = time.time()
        cloned = clone_repo(info, token=get_token(), ref=branch)
    except (GitHubAuthError, RepoSelectionError, BranchError, CloneError) as err:
        print(f"[FAILED] {err}")
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("\nCancelled.")
        raise SystemExit(130)

    files = [p for p in cloned.path.rglob("*") if p.is_file() and ".git" not in p.parts]
    print(f"[OK] Cloned in {time.time() - start:.1f}s\n")
    print(f"  Repository : {cloned.full_name}")
    print(f"  Branch     : {cloned.ref}")
    print(f"  Commit     : {cloned.commit_sha}")
    print(f"  Folder     : {cloned.path}")
    print(f"  Files      : {len(files)}")
    print("\n  (Folder is kept so you can look inside. Step 7 will delete it automatically.)")