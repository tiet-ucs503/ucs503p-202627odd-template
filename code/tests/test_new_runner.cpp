// test_new_runner.cpp — test suite for test.cpp (new / git-plumbing version)
//
// HOW TO COMPILE & RUN:
//   g++ -std=c++17 test_new_runner.cpp -o run_new && ./run_new
//
//
// NOTE: restoreVersion() currently only supports restoring to the same
// filename as the originally tracked file. Restore-to-different-filename
// (file rename support) is not yet implemented and will be added later.

#include "../src/lib/Bvr/version_vault/core.cpp"   // pulls in all functions: initRepo, trackFile, saveVersion,
                      // getHistory, restoreVersion, storeFile, createTree, etc.

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
    const string BASE  = "/tmp/vv_new_test";
    const string REPO  = BASE + "/repo";
    const string FILES = BASE + "/files";
    system(("rm -rf " + BASE).c_str());
    fs::create_directories(REPO);
    fs::create_directories(FILES);

    cout << "=== test.cpp (new / plumbing version) ===\n\n";

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

    // T5 – restoreVersion to same filename (happy path)
    // hist[0]=newest  hist[1]=middle  hist[2]=oldest
    ok = restoreVersion(REPO, hist[2], FILE_A);
    CHECK(ok, "T5: restoreVersion (same filename) returns true");
    string content = readFile(FILE_A);
    CHECK(content == "version one content\n", "T5: restored content matches Version 1");

    // T6 – restore middle version to same filename
    ok = restoreVersion(REPO, hist[1], FILE_A);
    CHECK(ok, "T6: restoreVersion middle (same filename) returns true");
    content = readFile(FILE_A);
    CHECK(content == "version two content\n", "T6: restored content matches Version 2");

    // T7 – independent fileId has separate history
    const string FILE_B = FILES + "/other.txt";
    writeFile(FILE_B, "file b v1\n");
    trackFile(REPO, "f2", FILE_B);
    auto hist2 = getHistory(REPO, "f2");
    CHECK(hist2.size() == 1, "T7: independent fileId starts its own 1-commit history");
    CHECK(hist2[0] != hist[0], "T7: f2 commit hash differs from f1");

    // T8 – getHistory on nonexistent fileId returns empty
    auto histNone = getHistory(REPO, "nonexistent");
    CHECK(histNone.empty(), "T8: getHistory on unknown fileId returns empty vector");

    // T9 – saveVersion before trackFile fails gracefully
    const string FILE_C = FILES + "/new.txt";
    writeFile(FILE_C, "content\n");
    ok = saveVersion(REPO, "untracked", FILE_C);
    CHECK(!ok, "T9: saveVersion without prior trackFile returns false");

    // T10 – trackFile on empty file
    const string FILE_D = FILES + "/empty.txt";
    writeFile(FILE_D, "");
    ok = trackFile(REPO, "f3", FILE_D);
    CHECK(ok, "T10: trackFile works on empty file");
    auto hist3 = getHistory(REPO, "f3");
    CHECK(hist3.size() == 1, "T10: empty file tracked as 1 commit");

    // T11 – f1 commit chain still intact after all operations
    hist = getHistory(REPO, "f1");
    CHECK(hist.size() == 3, "T11: f1 still has 3 commits after all ops");

    cout << "\n== Results (new/plumbing version): "
         << passed << " passed, " << failed << " failed ==\n";
    return failed == 0 ? 0 : 1;
}
