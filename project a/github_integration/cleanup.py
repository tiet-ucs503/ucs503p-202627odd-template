# github_integration/cleanup.py
#
# Stage 4 - Phase 15 (Step 7): ALWAYS delete temporary clones.
#
# Three tools:
#   remove_tree()          - delete a folder reliably, even on Windows,
#                            and refuse to delete anything outside the
#                            clone folder (safety guard)
#   temporary_clone()      - "with" block: clone -> use -> ALWAYS delete,
#                            even if the scan crashes or you press Ctrl+C
#   cleanup_stale_clones() - delete leftovers from runs that were killed
#                            hard (laptop shut down, terminal closed)

import logging
import os
import re
import shutil
import stat
import sys
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from github_integration.cloner import ClonedRepo, clone_repo, get_clone_dir
from github_integration.repos import RepoInfo

logger = logging.getLogger(__name__)

STALE_AFTER_HOURS = 24      # leftover clones older than this get removed


class UnsafeDeleteError(RuntimeError):
    """Raised when code tries to delete something outside the allowed folder."""


def _make_writable_and_retry(func, path, _exc) -> None:
    """Called by shutil.rmtree when deleting one file fails.

    On Windows, git marks files inside .git/objects as READ-ONLY, and
    Windows refuses to delete read-only files. So: remove the read-only
    flag, then try the same delete again. (This is the recipe from the
    official Python docs for shutil.rmtree.)
    """
    os.chmod(path, stat.S_IWRITE)
    func(path)


def remove_tree(path: Path, allowed_root: Path) -> bool:
    """Delete `path` and everything in it - but ONLY if it is inside `allowed_root`.

    Returns:
        True if the folder is gone, False if it could not be deleted
        (we log a warning instead of crashing - a leftover temp folder
        is annoying, but it should never break the scan result).

    Raises:
        UnsafeDeleteError: if `path` is not strictly inside `allowed_root`.
    """
    path = Path(path).resolve()
    root = Path(allowed_root).resolve()

    # SAFETY GUARD: a bug that passes the wrong path (say C:\Users\Yashti)
    # must never wipe your files. Only delete things INSIDE the root.
    if path == root or root not in path.parents:
        raise UnsafeDeleteError(f"Refusing to delete {path}: it is not inside {root}")

    if not path.exists():
        return True

    last_error: Exception | None = None
    for attempt in range(1, 4):              # Windows often needs a retry:
        try:                                 # antivirus / search indexer briefly
            if sys.version_info >= (3, 12):  # lock files that were just written
                shutil.rmtree(path, onexc=_make_writable_and_retry)
            else:
                shutil.rmtree(path, onerror=_make_writable_and_retry)
            return True
        except OSError as exc:
            last_error = exc
            time.sleep(0.5 * attempt)

    logger.warning("Could not delete %s: %s", path, last_error)
    return False


# What clone_repo() names its folders: tempfile.mkdtemp(prefix="owner__repo__")
# adds exactly 8 characters from [a-z0-9_]. GitHub owners are letters, digits
# and '-'; repo names are letters, digits, '.', '_' and '-'.
_CLONE_NAME = re.compile(r"^[A-Za-z0-9-]+__[A-Za-z0-9._-]+__[a-z0-9_]{8}$")


def _looks_like_our_clone(path: Path) -> bool:
    """True only for folders clone_repo() could have created.

    The clone dir is configurable (THREATLENS_CLONE_DIR) and might be a
    folder with other things in it, so "has __ in the name" is NOT enough.
    We need the exact name pattern AND either a .git folder (finished
    clone) or an empty folder (clone that died before git wrote anything).
    """
    if path.is_symlink() or not path.is_dir() or not _CLONE_NAME.match(path.name):
        return False
    if (path / ".git").is_dir():
        return True
    try:
        return not any(path.iterdir())
    except OSError:
        return False


def cleanup_stale_clones(max_age_hours: float = STALE_AFTER_HOURS) -> int:
    """Delete clone folders older than `max_age_hours`.

    `finally` blocks don't run if the process is killed hard, so
    leftovers can pile up. This sweeps them away on the next run.

    Returns:
        How many folders were removed.
    """
    clone_dir = get_clone_dir()
    cutoff = time.time() - max_age_hours * 3600
    removed = 0
    for child in clone_dir.iterdir():
        # Our clones are always named owner__repo__xxxxxxxx - leave anything else alone.
        if _looks_like_our_clone(child) and child.stat().st_mtime < cutoff:
            if remove_tree(child, allowed_root=clone_dir):
                removed += 1
    return removed


@contextmanager
def temporary_clone(repo: RepoInfo, token: str | None = None,
                    ref: str | None = None) -> Iterator[ClonedRepo]:
    """Clone a repo for the duration of a `with` block, then ALWAYS delete it.

    Usage:
        with temporary_clone(info, token, "main") as cloned:
            report, _ = scan_cloned_repo(cloned)
        # <- here the clone is already deleted, whatever happened inside
    """
    stale = cleanup_stale_clones()
    if stale:
        logger.info("Removed %d stale clone(s) from earlier runs.", stale)

    cloned = clone_repo(repo, token=token, ref=ref)
    try:
        yield cloned
    finally:
        # Runs on success, on an exception, and on Ctrl+C.
        remove_tree(cloned.path, allowed_root=get_clone_dir())