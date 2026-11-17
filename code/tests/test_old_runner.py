
import os
import shutil
from pathlib import Path

# Change this import based on the actual project structure
# from src.lib.Bvr.version_vault.core_old import (
#     initRepo, trackFile, saveVersion, getHistory,
#     restoreVersion, getCommandOutput
# )
from src.lib.Bvr.version_vault.core_old import (
    initRepo,
    trackFile,
    saveVersion,
    getHistory,
    restoreVersion,
    getCommandOutput
)

passed = 0
failed = 0


def CHECK(cond, label):
    global passed, failed

    if cond:
        print("[PASS]", label)
        passed += 1
    else:
        print("[FAIL]", label)
        failed += 1


def readFile(path):
    try:
        with open(path, "r") as f:
            return f.read()
    except:
        return ""


def writeFile(path, content):
    with open(path, "w") as f:
        f.write(content)


def main():
    BASE = "/tmp/vv_old_test"
    REPO = BASE + "/repo"
    FILES = BASE + "/files"

    if os.path.exists(BASE):
        shutil.rmtree(BASE)

    Path(REPO).mkdir(parents=True)
    Path(FILES).mkdir(parents=True)

    print("=== test_old.cpp (old / porcelain version) ===\n")

    # T1 - initRepo
    ok = initRepo(REPO)
    CHECK(ok, "T1: initRepo returns true")
    CHECK(
        os.path.exists(REPO + "/.git"),
        "T1: .git directory created"
    )

    # T2 - trackFile
    FILE_A = FILES + "/notes.txt"
    writeFile(FILE_A, "version one content\n")

    ok = trackFile(REPO, "f1", FILE_A)
    CHECK(ok, "T2: trackFile returns true")

    hist = getHistory(REPO, "f1")
    CHECK(
        len(hist) == 1,
        "T2: history has 1 commit after trackFile"
    )
    CHECK(
        len(hist[0]) == 40,
        "T2: commit hash is 40 hex chars"
    )

    # T3 - first saveVersion
    writeFile(FILE_A, "version two content\n")

    ok = saveVersion(REPO, "f1", FILE_A)
    CHECK(ok, "T3: saveVersion returns true")

    hist = getHistory(REPO, "f1")
    CHECK(
        len(hist) == 2,
        "T3: history grows to 2 commits"
    )

    # T4 - second saveVersion
    writeFile(FILE_A, "version three content\n")

    ok = saveVersion(REPO, "f1", FILE_A)
    CHECK(ok, "T4: second saveVersion returns true")

    hist = getHistory(REPO, "f1")
    CHECK(
        len(hist) == 3,
        "T4: history grows to 3 commits"
    )

    # T5 - restoreVersion to oldest
    # hist[0] = newest, hist[1] = middle, hist[2] = oldest
    RESTORE_PATH = FILES + "/restored.txt"

    ok = restoreVersion(
        REPO,
        "f1",
        hist[2],
        RESTORE_PATH
    )

    CHECK(
        ok,
        "T5: restoreVersion to Version 1 returns true"
    )

    content = readFile(RESTORE_PATH)
    CHECK(
        content == "version one content\n",
        "T5: restored content matches Version 1"
    )

    # T6 - restore middle version
    ok = restoreVersion(
        REPO,
        "f1",
        hist[1],
        RESTORE_PATH
    )

    CHECK(
        ok,
        "T6: restoreVersion to Version 2 returns true"
    )

    content = readFile(RESTORE_PATH)
    CHECK(
        content == "version two content\n",
        "T6: restored content matches Version 2"
    )

    # T7 - restore to a different output filename
    OTHER_PATH = FILES + "/copy.txt"

    ok = restoreVersion(
        REPO,
        "f1",
        hist[2],
        OTHER_PATH
    )

    CHECK(
        ok,
        "T7: restoreVersion to different output filename works"
    )

    content = readFile(OTHER_PATH)
    CHECK(
        content == "version one content\n",
        "T7: content correct at different output path"
    )

    # T8 - getHistory on nonexistent fileId
    histNone = getHistory(REPO, "nonexistent")

    CHECK(
        len(histNone) == 0,
        "T8: getHistory on unknown fileId returns empty vector"
    )

    # T9 - saveVersion before trackFile
    FILE_C = FILES + "/new.txt"
    writeFile(FILE_C, "content\n")

    ok = saveVersion(REPO, "untracked", FILE_C)

    CHECK(
        not ok,
        "T9: saveVersion without prior trackFile returns false"
    )

    # T10 - trackFile on empty file
    FILE_D = FILES + "/empty.txt"
    writeFile(FILE_D, "")

    ok = trackFile(REPO, "f2", FILE_D)

    CHECK(
        ok,
        "T10: trackFile works on empty file"
    )

    hist2 = getHistory(REPO, "f2")

    CHECK(
        len(hist2) == 1,
        "T10: empty file tracked as 1 commit"
    )

    # T11 - multiple fileIds are independent
    CHECK(
        len(hist) == 3,
        "T11: f1 still has 3 commits"
    )

    CHECK(
        len(hist2) == 1,
        "T11: f2 has 1 commit independently"
    )

    CHECK(
        hist[0] != hist2[0],
        "T11: commit hashes for f1 and f2 differ"
    )

    # T12 - history order: newest commit first
    msg = getCommandOutput(
        f'cd "{REPO}" && '
        f'git log -1 --format=%s refs/heads/file-f1'
    )

    CHECK(
        msg == "New Version",
        "T12: most recent commit message is 'New Version'"
    )

    print(
        f"\n== Results (old/porcelain version): "
        f"{passed} passed, {failed} failed =="
    )

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

