#include <cstdlib>
#include <cstdio>
#include <string>
#include <filesystem>
#include <iostream>

using namespace std;
namespace fs = std::filesystem;

string runCommand(const string& command) {
    FILE* pipe = popen(command.c_str(), "r");
    if (!pipe) return "";

    char buffer[256];
    string result;

    while (fgets(buffer, sizeof(buffer), pipe))
        result += buffer;

    pclose(pipe);

    if (!result.empty() && result.back() == '\n')
        result.pop_back();

    return result;
}

bool executeCommand(const string& command) {
    return system(command.c_str()) == 0;
}

bool initRepo(const string& repoPath) {
    string command = "git init \"" + repoPath + "\"";
    return executeCommand(command);
}

string storeFile(const string& repoPath, const string& filePath) {
    string command =
        "cd \"" + repoPath + "\" && "
        "git hash-object -w \"" + filePath + "\"";

    return runCommand(command);
}

string createTree(
    const string& repoPath,
    const string& blobHash,
    const string& fileName
) {
    string command =
        "cd \"" + repoPath + "\" && "
        "printf '100644 blob " + blobHash + "\\t" +
        fileName + "\\n' | git mktree";

    return runCommand(command);
}

string createCommit(
    const string& repoPath,
    const string& treeHash,
    const string& message,
    const string& parentCommit = ""
) {
    string command =
        "cd \"" + repoPath + "\" && "
        "git commit-tree " + treeHash;

    if (!parentCommit.empty())
        command += " -p " + parentCommit;

    command += " -m \"" + message + "\"";

    return runCommand(command);
}

bool updateFileRef(
    const string& repoPath,
    const string& fileId,
    const string& commitHash
) {
    string command =
        "cd \"" + repoPath + "\" && "
        "git update-ref refs/heads/file-" +
        fileId + " " + commitHash;

    return executeCommand(command);
}

bool trackFile(
    const string& repoPath,
    const string& fileId,
    const string& filePath
) {
    string fileName = fs::path(filePath).filename().string();

    string blobHash = storeFile(repoPath, filePath);
    if (blobHash.empty()) return false;

    string treeHash = createTree(repoPath, blobHash, fileName);
    if (treeHash.empty()) return false;

    string commitHash = createCommit(repoPath, treeHash, "Version 1");
    if (commitHash.empty()) return false;

    if (!updateFileRef(repoPath, fileId, commitHash))
        return false;

    return true;
}

bool saveVersion(
    const string& repoPath,
    const string& fileId,
    const string& filePath
) {
    string fileName = fs::path(filePath).filename().string();

    string blobHash = storeFile(repoPath, filePath);
    if (blobHash.empty()) return false;

    string treeHash = createTree(repoPath, blobHash, fileName);
    if (treeHash.empty()) return false;

    string command =
        "cd \"" + repoPath + "\" && "
        "git rev-parse refs/heads/file-" + fileId;

    string previousCommit = runCommand(command);
    if (previousCommit.empty()) return false;

    string commitHash = createCommit(
        repoPath,
        treeHash,
        "New Version",
        previousCommit
    );

    if (commitHash.empty()) return false;

    if (!updateFileRef(repoPath, fileId, commitHash))
        return false;

    return true;
}

vector<string> getHistory(
    const string& repoPath,
    const string& fileId
) {
    string command =
        "cd \"" + repoPath + "\" && "
        "git log --format=%H refs/heads/file-" + fileId;

    FILE* pipe = popen(command.c_str(), "r");

    vector<string> history;

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

bool restoreVersion(
    const string& repoPath,
    const string& commitHash,
    const string& filePath
) {
    string fileName =
        filePath.substr(filePath.find_last_of('/') + 1);

    string command =
        "cd \"" + repoPath + "\" && "
        "git show " + commitHash + ":" + fileName +
        " > \"" + filePath + "\"";

    return executeCommand(command);
}
