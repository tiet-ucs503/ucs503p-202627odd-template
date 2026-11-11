import tempfile
from pathlib import Path

from src.lib.Bvr.version_vault.track_folder import (
    trackFolder,
    saveFolderVersion,
    getFolderHistory,
    restoreFolderVersion,
    hasFolderChanged
)


passed = 0
failed = 0


def check(condition, label):
    global passed, failed

    if condition:
        print("[PASS]", label)
        passed += 1
    else:
        print("[FAIL]", label)
        failed += 1


def main():
    with tempfile.TemporaryDirectory() as temp_dir:
        base = Path(temp_dir)

        # T1 - nonexistent folder
        missing = base / "missing"
        check(
            trackFolder(str(missing)) is False,
            "T1: nonexistent folder is rejected"
        )

        # T2 - path is a file, not a folder
        not_folder = base / "file.txt"
        not_folder.write_text("test")
        check(
            trackFolder(str(not_folder)) is False,
            "T2: file path is rejected"
        )

        # T3 - track folder
        folder = base / "repo"
        folder.mkdir()
        file_a = folder / "notes.txt"
        file_a.write_text("version one\n")

        check(
            trackFolder(str(folder)) is True,
            "T3: folder is tracked successfully"
        )

        check(
            (folder / ".git").exists(),
            "T3: .git directory is created"
        )

        # T4 - history after initial tracking
        history = getFolderHistory(str(folder))
        check(
            len(history) == 1,
            "T4: initial folder history has one commit"
        )

        check(
            len(history[0]) == 40,
            "T4: initial commit hash has 40 characters"
        )

        # T5 - no changes immediately after tracking
        check(
            hasFolderChanged(str(folder)) is False,
            "T5: unchanged folder is detected as unchanged"
        )

        # T6 - detect modification
        file_a.write_text("version two\n")
        check(
            hasFolderChanged(str(folder)) is True,
            "T6: modified file is detected"
        )

        # T7 - save new version
        check(
            saveFolderVersion(
                str(folder),
                "Second Version"
            ) is True,
            "T7: folder version is saved successfully"
        )

        history = getFolderHistory(str(folder))
        check(
            len(history) == 2,
            "T7: history grows to two commits"
        )

        # T8 - no changes after save
        check(
            hasFolderChanged(str(folder)) is False,
            "T8: folder is clean after saving"
        )

        # T9 - restore first version
        check(
            restoreFolderVersion(
                str(folder),
                history[-1]
            ) is True,
            "T9: first version is restored successfully"
        )

        check(
            file_a.read_text() == "version one\n",
            "T9: restored content matches first version"
        )

        # T10 - save another version
        file_a.write_text("version three\n")
        check(
            saveFolderVersion(
                str(folder),
                "Third Version"
            ) is True,
            "T10: another folder version is saved"
        )

        history = getFolderHistory(str(folder))
        check(
            len(history) == 3,
            "T10: history grows to three commits"
        )

        # T11 - nonexistent Git repository
        plain_folder = base / "plain"
        plain_folder.mkdir()

        check(
            saveFolderVersion(str(plain_folder)) is False,
            "T11: saving an untracked folder fails"
        )

        check(
            getFolderHistory(str(plain_folder)) == [],
            "T11: history of untracked folder is empty"
        )

        check(
            hasFolderChanged(str(plain_folder)) is False,
            "T11: status of untracked folder is false"
        )

        check(
            restoreFolderVersion(str(plain_folder), "invalid") is False,
            "T11: restoring an untracked folder fails"
        )

        # T12 - empty folder
        empty_folder = base / "empty"
        empty_folder.mkdir()

        check(
            trackFolder(str(empty_folder)) is True,
            "T12: empty folder can be tracked"
        )

        check(
            len(getFolderHistory(str(empty_folder))) == 1,
            "T12: empty folder gets initial commit"
        )

    print(
        f"\n== Results (track_folder.py): "
        f"{passed} passed, {failed} failed =="
    )

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
