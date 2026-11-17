#include <cstdlib>
#include <cstdio>
#include <string>
#include <vector>
#include <filesystem>
#include <iostream>

using namespace std;
namespace fs = std::filesystem;


// ============================================================
// Command Helpers
// ============================================================

string runCommand(const string& command) {
    FILE* pipe = popen(command.c_str(), "r");

    if (!pipe)
        return "";

    char buffer[256];
    string result;

    while (fgets(buffer, sizeof(buffer), pipe)) {
        result += buffer;
    }

    pclose(pipe);

    if (!result.empty() && result.back() == '\n')
        result.pop_back();

    return result;
}


bool executeCommand(const string& command) {
    return system(command.c_str()) == 0;
}


// ============================================================
// Folder Tracking
// ============================================================

// Initialize the folder as a Git repository
bool trackFolder(const string& folderPath) {

    if (!fs::exists(folderPath)) {
        cerr << "Error: Folder does not exist.\n";
        return false;
    }

    if (!fs::is_directory(folderPath)) {
        cerr << "Error: Path is not a directory.\n";
        return false;
    }

    // Check if already a Git repository
    if (fs::exists(fs::path(folderPath) / ".git")) {
        cout << "Folder is already being tracked.\n";
        return true;
    }

    string command =
        "git init \"" + folderPath + "\"";

    return executeCommand(command);
}


// ============================================================
// Save Folder Version
// ============================================================

bool saveFolderVersion(
    const string& folderPath,
    const string& message = "New folder version"
) {

    if (!fs::exists(fs::path(folderPath) / ".git")) {
        cerr << "Error: Folder is not a VersionVault repository.\n";
        return false;
    }

    string command =
        "cd \"" + folderPath + "\" && "
        "git add . && "
        "git commit -m \"" + message + "\"";

    return executeCommand(command);
}


// ============================================================
// Get Folder History
// ============================================================

vector<string> getFolderHistory(
    const string& folderPath
) {

    vector<string> history;

    if (!fs::exists(fs::path(folderPath) / ".git")) {
        cerr << "Error: Folder is not a Git repository.\n";
        return history;
    }

    string command =
        "cd \"" + folderPath + "\" && "
        "git log --format=%H";

    FILE* pipe = popen(command.c_str(), "r");

    if (!pipe)
        return history;

    char buffer[256];

    while (fgets(buffer, sizeof(buffer), pipe)) {

        string commit = buffer;

        if (!commit.empty() && commit.back() == '\n')
            commit.pop_back();

        history.push_back(commit);
    }

    pclose(pipe);

    return history;
}


// ============================================================
// Restore Folder Version
// ============================================================

bool restoreFolderVersion(
    const string& folderPath,
    const string& commitHash
) {

    if (!fs::exists(fs::path(folderPath) / ".git")) {
        cerr << "Error: Folder is not a Git repository.\n";
        return false;
    }

    // Restore all tracked files to the selected commit
    string command =
        "cd \"" + folderPath + "\" && "
        "git checkout " + commitHash + " -- .";

    return executeCommand(command);
}


// ============================================================
// Check Folder Status
// ============================================================

bool hasFolderChanged(
    const string& folderPath
) {

    string command =
        "cd \"" + folderPath + "\" && "
        "git status --porcelain";

    string result = runCommand(command);

    return !result.empty();
}


// ============================================================
// Simple Test
// ============================================================

#ifdef FOLDER_TRACKER_TEST

int main(int argc, char* argv[]) {

    if (argc < 3) {
        cout << "Usage:\n";
        cout << "  ./track_folder track <folder_path>\n";
        cout << "  ./track_folder status <folder_path>\n";
        cout << "  ./track_folder save <folder_path> <message>\n";
        cout << "  ./track_folder history <folder_path>\n";
        cout << "  ./track_folder restore <folder_path> <commit_hash>\n";
        return 1;
    }

    string command = argv[1];
    string folderPath = argv[2];


    // TRACK FOLDER
    if (command == "track") {

        if (trackFolder(folderPath))
            cout << "SUCCESS: Folder is now being tracked.\n";
        else
            cout << "FAILED: Could not track folder.\n";
    }


    // CHECK STATUS
    else if (command == "status") {

        if (hasFolderChanged(folderPath))
            cout << "Changes detected.\n";
        else
            cout << "No changes detected.\n";
    }


    // SAVE VERSION
    else if (command == "save") {

        if (argc < 4) {
            cout << "Error: Version message required.\n";
            return 1;
        }

        string message = argv[3];

        if (saveFolderVersion(folderPath, message))
            cout << "SUCCESS: Folder version saved.\n";
        else
            cout << "FAILED: Could not save version.\n";
    }


    // VIEW HISTORY
    else if (command == "history") {

        vector<string> history =
            getFolderHistory(folderPath);

        if (history.empty()) {
            cout << "No versions found.\n";
            return 0;
        }

        cout << "Folder Version History:\n";

        for (int i = 0; i < history.size(); i++) {
            cout << i + 1
                 << ". "
                 << history[i]
                 << "\n";
        }
    }


    // RESTORE VERSION
    else if (command == "restore") {

        if (argc < 4) {
            cout << "Error: Commit hash required.\n";
            return 1;
        }

        string commitHash = argv[3];

        if (restoreFolderVersion(
                folderPath,
                commitHash
            )) {

            cout << "SUCCESS: Folder restored.\n";

        } else {

            cout << "FAILED: Could not restore version.\n";
        }
    }


    else {
        cout << "Unknown command: " << command << "\n";
    }

    return 0;
}

#endif