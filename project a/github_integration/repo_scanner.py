# github_integration/repo_scanner.py
#
# Stage 4 - Phase 15 (Step 6): Scan a cloned GitHub repository.
#
# Takes the folder made by cloner.py (Step 5) and:
#   1. removes junk folders (installed libraries, caches) from the COPY
#   2. runs Vidhi's SecurityEngine on it - unchanged
#   3. turns absolute file paths into repo-relative ones ("app/config.py")
#
# Deleting the clone afterwards is handled by cleanup.temporary_clone (Step 7).

from pathlib import Path

from engine.finding import Finding
from engine.security_engine import ScanReport, SecurityEngine
from github_integration.cleanup import remove_tree
from github_integration.cloner import ClonedRepo
from scanners.gitleaks_scanner import GitleaksScanner
from scanners.osv_scanner import OsvScanner
from scanners.semgrep_scanner import SemgrepScanner

# Folders that hold OTHER people's code (installed libraries) or caches.
# Scanning them gives slow scans and hundreds of false alarms - you saw
# this when your own venv got scanned. Matched by exact folder name.
JUNK_DIR_NAMES = {
    "node_modules",       # JavaScript libraries
    "bower_components",
    "site-packages",      # Python libraries
    "__pycache__",        # Python compiled cache
    ".mypy_cache",
    ".pytest_cache",
    ".tox",
}


def _is_virtualenv(folder: Path) -> bool:
    """Every Python virtual environment has a pyvenv.cfg file at its root.

    Checking for that file catches venvs whatever they are called -
    'venv', '.venv', 'env', or 'threatlens' like yours.
    """
    return (folder / "pyvenv.cfg").is_file()


def remove_junk_dirs(root: Path) -> list[str]:
    """Delete junk folders inside `root` (a disposable clone!).

    Never call this on a real project folder - it deletes things.

    Returns:
        The removed folders, relative to root (for logging).
    """
    removed: list[str] = []
    # Walk top-down and skip into a folder only if it is not junk.
    stack = [root]
    while stack:
        current = stack.pop()
        for child in current.iterdir():
            if not child.is_dir() or child.is_symlink() or child.name == ".git":
                continue
            if child.name in JUNK_DIR_NAMES or _is_virtualenv(child):
                remove_tree(child, allowed_root=root)
                removed.append(child.relative_to(root).as_posix())
            else:
                stack.append(child)
    return sorted(removed)


def _relative_path(file: str, root: Path) -> str:
    """'C:/Users/.../clone/app/config.py' -> 'app/config.py'.

    Scanners are inconsistent: Gitleaks and OSV give absolute paths,
    Semgrep gives relative ones. GitHub (Stage 5 PR comments) needs
    paths relative to the repo root, with forward slashes.
    """
    if not file:
        return file
    path = Path(file)
    if path.is_absolute():
        try:
            path = path.relative_to(root)
        except ValueError:
            return path.as_posix()          # outside the repo - leave as is
    return path.as_posix()


def build_engine(path: Path) -> SecurityEngine:
    """The standard ThreatLens scanner set - same as threatlens.py uses."""
    return (
        SecurityEngine(repo_path=str(path))
        .add_scanner("Gitleaks", GitleaksScanner())
        .add_scanner("OSV-Scanner", OsvScanner())
        .add_scanner("Semgrep", SemgrepScanner())
    )


def scan_cloned_repo(cloned: ClonedRepo) -> tuple[ScanReport, list[str]]:
    """Clean the clone, scan it, and normalise file paths.

    Returns:
        (report, removed_junk_dirs)
    """
    root = cloned.path.resolve()
    removed = remove_junk_dirs(root)

    report = build_engine(root).scan()

    finding: Finding
    for finding in report.findings:
        finding.file = _relative_path(finding.file, root)

    return report, removed


# Run directly to test:
#     python -m github_integration.repo_scanner owner/repo          -> asks which branch
#     python -m github_integration.repo_scanner owner/repo dev      -> branch "dev"
if __name__ == "__main__":
    import io
    import logging
    import sys
    import time

    from github_integration.branches import BranchError, list_branches, prompt_for_branch
    from github_integration.cleanup import temporary_clone
    from github_integration.client import (
        PROJECT_ROOT,
        GitHubAuthError,
        get_github_client,
        get_token,
        verify_connection,
    )
    from github_integration.cloner import CloneError
    from github_integration.repo_selector import RepoSelectionError, select_repo
    from reporting.html_report import write_html_report

    # line_buffering=True -> each print appears immediately, in the right order
    # relative to log messages (which go to stderr unbuffered).
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace",
                                  line_buffering=True)
    logging.basicConfig(level=logging.WARNING)   # show scanner warnings/errors only

    if len(sys.argv) not in (2, 3):
        print("Usage: python -m github_integration.repo_scanner owner/repo [branch]")
        raise SystemExit(2)

    try:
        gh = get_github_client()
        verify_connection(gh)
        info = select_repo(gh, sys.argv[1])

        if len(sys.argv) == 3:
            branch = sys.argv[2]
        else:
            branches = list_branches(gh, info)
            branch = branches[0] if len(branches) == 1 else prompt_for_branch(branches, info.default_branch)

        print(f"\n[1/4] Cloning {info.full_name} (branch '{branch}')...")
        start = time.time()

        # Everything inside this "with" block can use the clone.
        # The moment the block ends - normally, by error, or by Ctrl+C -
        # temporary_clone() deletes the folder.
        with temporary_clone(info, token=get_token(), ref=branch) as cloned:
            print(f"[2/4] Scanning {cloned.path} ... (Semgrep can take a minute)")
            report, removed = scan_cloned_repo(cloned)
            if removed:
                print(f"      Skipped {len(removed)} junk folder(s): {', '.join(removed[:5])}"
                      f"{' ...' if len(removed) > 5 else ''}")
            print("[3/4] Deleting the temporary clone...")
            clone_path = cloned.path

    except (GitHubAuthError, RepoSelectionError, BranchError, CloneError) as err:
        print(f"[FAILED] {err}")
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("\nCancelled. (Any temporary clone was deleted.)")
        raise SystemExit(130)

    html_path = write_html_report(
        report,
        output_dir=PROJECT_ROOT / "reports",
        name=info.full_name.replace("/", "_"),
        details={
            "Repository": info.full_name,
            "Branch": cloned.ref,
            "Commit": cloned.commit_sha[:12],
        },
    )

    print(f"[4/4] Done in {time.time() - start:.0f}s\n")
    print(f"  Issues found : {report.total}")
    for sev, count in report.summary.items():
        if count:
            print(f"    {sev:<9}: {count}")
    for r in report.failed_scanners:
        print(f"  [!] {r.scanner_name} FAILED - results are incomplete")
    print(f"\n  Report       : {html_path}")
    print(f"  Clone deleted: {'yes' if not clone_path.exists() else 'NO - still at ' + str(clone_path)}")