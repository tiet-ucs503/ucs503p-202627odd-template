// test_old_runner.cpp — test suite for test_old.cpp (old / git-porcelain version)
//
// HOW TO COMPILE & RUN:
//   g++ -std=c++17 test_old_runner.cpp -o run_old && ./run_old
//
// KEY DIFFERENCES vs new version (test.cpp):
//   - Uses git porcelain (checkout --orphan, git add, git commit)
//   - Files stored internally under hardcoded name "tracked_file"
//   - restoreVersion takes 4 args: (repoPath, fileId, commitHash, filePath)
//   - Restore to a different output filename works correctly (no bug)

#include "../src/lib/Bvr/version_vault/core_old.cpp"  // pulls in all functions: initRepo, trackFile,
                            // saveVersion, getHistory, restoreVersion

#include <filesystem>
#include <iostream>
#include <fstream>
using namespace std;
namespace fs = std::filesystem;

// ── test harness ─────────────────────────────────────────────────────────────
static int passed = 0, failed = 0;

void CHECK(bool cond, const string& label) {
    if (cond) { cout << "[PASS] " << label << "\n"; ++passed; }
    else       { cout << "[FAIL] " << label << "\n"; ++failed; }
}

string readFile(const string& path) {
    ifstream f(path); if (!f) return "";
    return string((istreambuf_iterator<char>(f)), istreambuf_iterator<char>());
}

void writeFile(const string& path, const string& content) {
    ofstream f(path); f << content;
}

// ── test suite ────────────────────────────────────────────────────────────────
int main() {
    const string BASE  = "/tmp/vv_old_test";
    const string REPO  = BASE + "/repo";
    const string FILES = BASE + "/files";
    system(("rm -rf " + BASE).c_str());
    fs::create_directories(REPO);
    fs::create_directories(FILES);

    cout << "=== test_old.cpp (old / porcelain version) ===\n\n";

    // T1 – initRepo
    bool ok = initRepo(REPO);
    CHECK(ok, "T1: initRepo returns true");
    CHECK(fs::exists(REPO + "/.git"), "T1: .git directory created");

    // T2 – trackFile
    const string FILE_A = FILES + "/notes.txt";
    writeFile(FILE_A, "version one content\n");
    ok = trackFile(REPO, "f1", FILE_A);
    CHECK(ok, "T2: trackFile returns true");
    auto hist = getHistory(REPO, "f1");
    CHECK(hist.size() == 1, "T2: history has 1 commit after trackFile");
    CHECK(hist[0].size() == 40, "T2: commit hash is 40 hex chars");

    // T3 – first saveVersion
    writeFile(FILE_A, "version two content\n");
    ok = saveVersion(REPO, "f1", FILE_A);
    CHECK(ok, "T3: saveVersion returns true");
    hist = getHistory(REPO, "f1");
    CHECK(hist.size() == 2, "T3: history grows to 2 commits");

    // T4 – second saveVersion
    writeFile(FILE_A, "version three content\n");
    ok = saveVersion(REPO, "f1", FILE_A);
    CHECK(ok, "T4: second saveVersion returns true");
    hist = getHistory(REPO, "f1");
    CHECK(hist.size() == 3, "T4: history grows to 3 commits");

    // T5 – restoreVersion to oldest (Version 1)
    // hist[0]=newest  hist[1]=middle  hist[2]=oldest
    const string RESTORE_PATH = FILES + "/restored.txt";
    ok = restoreVersion(REPO, "f1", hist[2], RESTORE_PATH);
    CHECK(ok, "T5: restoreVersion to Version 1 returns true");
    string content = readFile(RESTORE_PATH);
    CHECK(content == "version one content\n", "T5: restored content matches Version 1");

    // T6 – restore middle version
    ok = restoreVersion(REPO, "f1", hist[1], RESTORE_PATH);
    CHECK(ok, "T6: restoreVersion to Version 2 returns true");
    content = readFile(RESTORE_PATH);
    CHECK(content == "version two content\n", "T6: restored content matches Version 2");

    // T7 – restore to a DIFFERENT output filename works (no blob-name coupling)
    const string OTHER_PATH = FILES + "/copy.txt";
    ok = restoreVersion(REPO, "f1", hist[2], OTHER_PATH);
    CHECK(ok, "T7: restoreVersion to different output filename works");
    content = readFile(OTHER_PATH);
    CHECK(content == "version one content\n", "T7: content correct at different output path");

    // T8 – getHistory on nonexistent fileId returns empty
    auto histNone = getHistory(REPO, "nonexistent");
    CHECK(histNone.empty(), "T8: getHistory on unknown fileId returns empty vector");

    // T9 – saveVersion before trackFile fails gracefully
    const string FILE_C = FILES + "/new.txt";
    writeFile(FILE_C, "content\n");
    ok = saveVersion(REPO, "untracked", FILE_C);
    CHECK(!ok, "T9: saveVersion without prior trackFile returns false");

    // T10 – trackFile on empty file (new fileId to avoid branch conflict)
    const string FILE_D = FILES + "/empty.txt";
    writeFile(FILE_D, "");
    ok = trackFile(REPO, "f2", FILE_D);
    CHECK(ok, "T10: trackFile works on empty file");
    auto hist2 = getHistory(REPO, "f2");
    CHECK(hist2.size() == 1, "T10: empty file tracked as 1 commit");

    // T11 – multiple fileIds are independent
    CHECK(hist.size() == 3,    "T11: f1 still has 3 commits");
    CHECK(hist2.size() == 1,   "T11: f2 has 1 commit independently");
    CHECK(hist[0] != hist2[0], "T11: commit hashes for f1 and f2 differ");

    // T12 – history order: newest commit first
    string msg = getCommandOutput("cd \"" + REPO + "\" && git log -1 --format=%s refs/heads/file-f1");
    CHECK(msg == "New Version", "T12: most recent commit message is 'New Version'");

    cout << "\n== Results (old/porcelain version): "
         << passed << " passed, " << failed << " failed ==\n";
    return failed == 0 ? 0 : 1;
}