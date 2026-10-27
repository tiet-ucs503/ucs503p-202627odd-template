#include <iostream>
#include <vector>
#include <string>

#include "../lib/Bvr/version_vault/core.cpp"

using namespace std;

const string REPO_PATH = "/Users/tanaysingh/Desktop/version_vault_repo";

void printUsage() {
    cout << R"(
VersionVault CLI

Usage:
  vv init
  vv track <file-id> <file-path>
  vv save <file-id> <file-path>
  vv history <file-id>
  vv restore <commit-hash> <file-path>

)";
}

int main(int argc, char* argv[]) {

    if (argc < 2) {
        printUsage();
        return 1;
    }

    string command = argv[1];

    // vv init
    if (command == "init") {

        if (initRepo(REPO_PATH))
            cout << "Repository initialized successfully.\n";
        else
            cout << "Failed to initialize repository.\n";
    }

    // vv track f1 notes.txt
    else if (command == "track") {

        if (argc != 4) {
            cout << "Usage: vv track <file-id> <file-path>\n";
            return 1;
        }

        if (trackFile(REPO_PATH, argv[2], argv[3]))
            cout << "File tracked successfully.\n";
        else
            cout << "Failed to track file.\n";
    }

    // vv save f1 notes.txt
    else if (command == "save") {

        if (argc != 4) {
            cout << "Usage: vv save <file-id> <file-path>\n";
            return 1;
        }

        if (saveVersion(REPO_PATH, argv[2], argv[3]))
            cout << "New version saved successfully.\n";
        else
            cout << "Failed to save version.\n";
    }

    // vv history f1
    else if (command == "history") {

        if (argc != 3) {
            cout << "Usage: vv history <file-id>\n";
            return 1;
        }

        vector<string> history = getHistory(REPO_PATH, argv[2]);

        if (history.empty()) {
            cout << "No version history found.\n";
            return 0;
        }

        cout << "\nVersion History\n";
        cout << "===============\n";

        for (size_t i = 0; i < history.size(); i++) {
            cout << i + 1 << ". " << history[i] << '\n';
        }
    }

    // vv restore <commit-hash> <file-path>
    else if (command == "restore") {

        if (argc != 4) {
            cout << "Usage: vv restore <commit-hash> <file-path>\n";
            return 1;
        }

        if (restoreVersion(REPO_PATH, argv[2], argv[3]))
            cout << "Version restored successfully.\n";
        else
            cout << "Failed to restore version.\n";
    }

    else {
        cout << "Unknown command: " << command << "\n";
        printUsage();
        return 1;
    }

    return 0;
}