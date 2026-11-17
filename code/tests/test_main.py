import os
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_PATH = PROJECT_ROOT / "src" / "bin" / "main.py"


def run_main(*args):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(PROJECT_ROOT)

    return subprocess.run(
        [sys.executable, str(MAIN_PATH), *args],
        capture_output=True,
        text=True,
        env=env
    )


def check(condition, label):
    if condition:
        print("[PASS]", label)
        return 1, 0
    else:
        print("[FAIL]", label)
        return 0, 1


def main():
    passed = 0
    failed = 0

    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        repo = temp / "repo"
        file_path = temp / "notes.txt"
        restored_path = temp / "restored.txt"
        folder = temp / "folder"

        # Use a temporary HOME so this test does not touch the real database.
        env_home = temp / "home"
        env_home.mkdir()

        env = os.environ.copy()
        env["PYTHONPATH"] = str(PROJECT_ROOT)
        env["HOME"] = str(env_home)

        def run(*args):
            return subprocess.run(
                [sys.executable, str(MAIN_PATH), *args],
                capture_output=True,
                text=True,
                env=env
            )

        # T1 - no command
        result = run()
        p, f = check(
            result.returncode == 1 and "VersionVault CLI" in result.stdout,
            "T1: no command prints usage"
        )
        passed += p
        failed += f

        # T2 - init
        result = run("init")
        p, f = check(
            result.returncode == 0
            and "Repository initialized successfully." in result.stdout
            and (Path("/tmp/version_vault_repo") / ".git").exists(),
            "T2: init initializes repository"
        )
        passed += p
        failed += f

        # T3 - track file
        file_path.write_text("version one\n")
        result = run("track", str(file_path))
        p, f = check(
            result.returncode == 0
            and "File tracked successfully with ID:" in result.stdout,
            "T3: track command succeeds"
        )
        passed += p
        failed += f

        # T4 - duplicate track
        result = run("track", str(file_path))
        p, f = check(
            result.returncode == 1
            and "already being tracked" in result.stdout,
            "T4: duplicate file tracking is rejected"
        )
        passed += p
        failed += f

        # T5 - save
        file_path.write_text("version two\n")
        result = run("save", str(file_path))
        p, f = check(
            result.returncode == 0
            and "New version saved successfully." in result.stdout,
            "T5: save command succeeds"
        )
        passed += p
        failed += f

        # T6 - history
        result = run("history", str(file_path))
        history_lines = [
            line for line in result.stdout.splitlines()
            if line.startswith(("1. ", "2. "))
        ]
        p, f = check(
            result.returncode == 0
            and "Version History" in result.stdout
            and len(history_lines) == 2,
            "T6: history shows two versions"
        )
        passed += p
        failed += f

        # T7 - restore
        hashes = [
            line.split(". ", 1)[1]
            for line in history_lines
            if ". " in line
        ]

        if len(hashes) >= 2:
            result = run("restore", hashes[-1], str(restored_path))
            restored_content = (
                restored_path.read_text()
                if restored_path.exists()
                else ""
            )
            

            p, f = check(
                result.returncode == 0
                and "Version restored successfully." in result.stdout
                and restored_content == "version one\n",
                "T7: restore command restores old version"
            )
        else:
            p, f = check(False, "T7: restore command restores old version")
        passed += p
        failed += f

        # T8 - folder tracking
        folder.mkdir()
        (folder / "file.txt").write_text("folder version one\n")

        result = run("track-folder", str(folder))
        p, f = check(
            result.returncode == 0
            and "SUCCESS: Folder is now being tracked" in result.stdout
            and (folder / ".git").exists(),
            "T8: track-folder initializes and tracks folder"
        )
        passed += p
        failed += f

        # T9 - folder status with no changes
        result = run("status", str(folder))
        p, f = check(
            result.returncode == 0
            and "No changes detected." in result.stdout,
            "T9: status reports no changes"
        )
        passed += p
        failed += f

        # T10 - folder change detection
        (folder / "file.txt").write_text("folder version two\n")
        result = run("status", str(folder))
        p, f = check(
            result.returncode == 0
            and "Changes detected." in result.stdout,
            "T10: status detects folder changes"
        )
        passed += p
        failed += f

        # T11 - save folder
        result = run(
            "save-folder",
            str(folder),
            "Second folder version"
        )
        p, f = check(
            result.returncode == 0
            and "SUCCESS: Folder version saved." in result.stdout,
            "T11: save-folder creates new version"
        )
        passed += p
        failed += f

        # T12 - folder history
        result = run("history-folder", str(folder))
        p, f = check(
            result.returncode == 0
            and "Folder Version History" in result.stdout
            and len([
                line for line in result.stdout.splitlines()
                if line.startswith(("1. ", "2. "))
            ]) >= 2,
            "T12: history-folder shows versions"
        )
        passed += p
        failed += f

    print(
        f"\n== Results (main.py): "
        f"{passed} passed, {failed} failed =="
    )

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
