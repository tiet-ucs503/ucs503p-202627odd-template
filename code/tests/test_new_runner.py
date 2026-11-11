
import os
import shutil
from pathlib import Path

# Change this import based on the actual project structure
# from src.lib.Bvr.version_vault.core import (
#     initRepo, trackFile, saveVersion, getHistory, restoreVersion
# )

from src.lib.Bvr.version_vault.core import (
    initRepo,
    trackFile,
    saveVersion,
    getHistory,
    restoreVersion
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
    BASE = "/tmp/vv_new_test"
    REPO = BASE + "/repo"
    FILES = BASE + "/files"

    if os.path.exists(BASE):
        shutil.rmtree(BASE)

    Path(REPO).mkdir(parents=True)
    Path(FILES).mkdir(parents=True)

    print("=== test.cpp (new / plumbing version) ===\n")

    # T1 - initRepo
    ok = initRepo(REPO)
    CHECK(ok, "T1: initRepo returns true")
    CHECK(os.path.exists(REPO + "/.git"),
          "T1: .git directory created")

    # T2 - trackFile
    FILE_A = FILES + "/notes.txt"
    writeFile(FILE_A, "version one content\n")

    ok = trackFile(REPO, "f1", FILE_A)
    CHECK(ok, "T2: trackFile returns true")

    hist = getHistory(REPO, "f1")
    CHECK(len(hist) == 1,
          "T2: history has 1 commit after trackFile")
    CHECK(len(hist[0]) == 40,
          "T2: commit hash is 40 hex chars")

    # T3 - first saveVersion
    writeFile(FILE_A, "version two content\n")

    ok = saveVersion(REPO, "f1", FILE_A)
    CHECK(ok, "T3: saveVersion returns true")

    hist = getHistory(REPO, "f1")
    CHECK(len(hist) == 2,
          "T3: history grows to 2 commits")

    # T4 - second saveVersion
    writeFile(FILE_A, "version three content\n")

    ok = saveVersion(REPO, "f1", FILE_A)
    CHECK(ok, "T4: second saveVersion returns true")

    hist = getHistory(REPO, "f1")
    CHECK(len(hist) == 3,
          "T4: history grows to 3 commits")

    # T5 - restoreVersion to same filename
    # hist[0] = newest, hist[1] = middle, hist[2] = oldest
    ok = restoreVersion(REPO, hist[2], FILE_A)
    CHECK(ok,
          "T5: restoreVersion (same filename) returns true")

    content = readFile(FILE_A)
    CHECK(content == "version one content\n",
          "T5: restored content matches Version 1")

    # T6 - restore middle version
    ok = restoreVersion(REPO, hist[1], FILE_A)
    CHECK(ok,
          "T6: restoreVersion middle (same filename) returns true")

    content = readFile(FILE_A)
    CHECK(content == "version two content\n",
          "T6: restored content matches Version 2")

    # T7 - independent fileId has separate history
    FILE_B = FILES + "/other.txt"
    writeFile(FILE_B, "file b v1\n")

    trackFile(REPO, "f2", FILE_B)

    hist2 = getHistory(REPO, "f2")
    CHECK(len(hist2) == 1,
          "T7: independent fileId starts its own 1-commit history")
    CHECK(hist2[0] != hist[0],
          "T7: f2 commit hash differs from f1")

    # T8 - getHistory on nonexistent fileId
    histNone = getHistory(REPO, "nonexistent")
    CHECK(len(histNone) == 0,
          "T8: getHistory on unknown fileId returns empty vector")

    # T9 - saveVersion before trackFile
    FILE_C = FILES + "/new.txt"
    writeFile(FILE_C, "content\n")

    ok = saveVersion(REPO, "untracked", FILE_C)
    CHECK(not ok,
          "T9: saveVersion without prior trackFile returns false")

    # T10 - trackFile on empty file
    FILE_D = FILES + "/empty.txt"
    writeFile(FILE_D, "")

    ok = trackFile(REPO, "f3", FILE_D)
    CHECK(ok,
          "T10: trackFile works on empty file")

    hist3 = getHistory(REPO, "f3")
    CHECK(len(hist3) == 1,
          "T10: empty file tracked as 1 commit")

    # T11 - f1 commit chain still intact
    hist = getHistory(REPO, "f1")
    CHECK(len(hist) == 3,
          "T11: f1 still has 3 commits after all ops")

    print(
        "\n== Results (new/plumbing version): "
        f"{passed} passed, {failed} failed =="
    )

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

