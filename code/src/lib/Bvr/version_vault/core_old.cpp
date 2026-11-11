#include <cstdlib>
#include <cstdio>
#include <string>
#include <vector>
#include <iostream>

using namespace std;

bool runCommand(const string& command) {
    return system(command.c_str()) == 0;
}

string getCommandOutput(const string& command) {
    FILE* pipe = popen(command.c_str(), "r");

    if (!pipe)
        return "";

    char buffer[256];
    string result;

    while (fgets(buffer, sizeof(buffer), pipe))
        result += buffer;

    pclose(pipe);

    if (!result.empty() && result.back() == '\n')
        result.pop_back();

    return result;
}

bool initRepo(const string& repoPath) {

    string command =
        "git init \"" + repoPath + "\"";

    return runCommand(command);
}

bool trackFile(
    const string& repoPath,
    const string& fileId,
    const string& filePath
) {

    string command =
        "cd \"" + repoPath + "\" && "
        "git checkout --orphan file-" + fileId;

    if (!runCommand(command))
        return false;

    command =
        "cp \"" + filePath + "\" \"" +
        repoPath + "/tracked_file\"";

    if (!runCommand(command))
        return false;

    command =
        "cd \"" + repoPath + "\" && "
        "git add tracked_file";

    if (!runCommand(command))
        return false;

    command =
        "cd \"" + repoPath + "\" && "
        "git commit -m \"Version 1\"";

    if (!runCommand(command))
        return false;

    command =
        "rm \"" + repoPath + "/tracked_file\"";

    if (!runCommand(command))
        return false;

    return true;
}

bool saveVersion(
    const string& repoPath,
    const string& fileId,
    const string& filePath
) {

    string command =
        "cd \"" + repoPath + "\" && "
        "git checkout file-" + fileId;

    if (!runCommand(command))
        return false;

    command =
        "cp \"" + filePath + "\" \"" +
        repoPath + "/tracked_file\"";

    if (!runCommand(command))
        return false;

    command =
        "cd \"" + repoPath + "\" && "
        "git add tracked_file";

    if (!runCommand(command))
        return false;

    command =
        "cd \"" + repoPath + "\" && "
        "git commit -m \"New Version\"";

    if (!runCommand(command))
        return false;

    command =
        "rm \"" + repoPath + "/tracked_file\"";

    if (!runCommand(command))
        return false;

    return true;
}

vector<string> getHistory(
    const string& repoPath,
    const string& fileId
) {

    string command =
        "cd \"" + repoPath + "\" && "
        "git log --format=%H refs/heads/file-" +
        fileId;

    FILE* pipe = popen(command.c_str(), "r");

    vector<string> history;

    if (!pipe)
        return history;

    char buffer[256];

    while (fgets(buffer, sizeof(buffer), pipe)) {

        string commit = buffer;

        if (!commit.empty() &&
            commit.back() == '\n') {

            commit.pop_back();
        }

        history.push_back(commit);
    }

    pclose(pipe);

    return history;
}

bool restoreVersion(
    const string& repoPath,
    const string& fileId,
    const string& commitHash,
    const string& filePath
) {

    string command =
        "cd \"" + repoPath + "\" && "
        "git checkout " + commitHash +
        " -- tracked_file";

    if (!runCommand(command))
        return false;

    command =
        "cp \"" + repoPath + "/tracked_file\" \"" +
        filePath + "\"";

    if (!runCommand(command))
        return false;

    command =
        "cd \"" + repoPath + "\" && "
        "git restore --staged tracked_file";

    runCommand(command);

    command =
        "rm \"" + repoPath + "/tracked_file\"";

    runCommand(command);

    return true;
}
