
import os
import shutil
import subprocess


def runCommand(command):
    return subprocess.run(command, shell=True).returncode == 0


def getCommandOutput(command):
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return ""

    return result.stdout.rstrip("\n")


def initRepo(repoPath):
    command = f'git init "{repoPath}"'
    return runCommand(command)


def trackFile(repoPath, fileId, filePath):
    command = (
        f'cd "{repoPath}" && '
        f'git checkout --orphan file-{fileId}'
    )

    if not runCommand(command):
        return False

    command = (
        f'cp "{filePath}" '
        f'"{repoPath}/tracked_file"'
    )

    if not runCommand(command):
        return False

    command = (
        f'cd "{repoPath}" && '
        f'git add tracked_file'
    )

    if not runCommand(command):
        return False

    command = (
        f'cd "{repoPath}" && '
        f'git commit -m "Version 1"'
    )

    if not runCommand(command):
        return False

    command = f'rm "{repoPath}/tracked_file"'

    if not runCommand(command):
        return False

    return True


def saveVersion(repoPath, fileId, filePath):
    command = (
        f'cd "{repoPath}" && '
        f'git checkout file-{fileId}'
    )

    if not runCommand(command):
        return False

    command = (
        f'cp "{filePath}" '
        f'"{repoPath}/tracked_file"'
    )

    if not runCommand(command):
        return False

    command = (
        f'cd "{repoPath}" && '
        f'git add tracked_file'
    )

    if not runCommand(command):
        return False

    command = (
        f'cd "{repoPath}" && '
        f'git commit -m "New Version"'
    )

    if not runCommand(command):
        return False

    command = f'rm "{repoPath}/tracked_file"'

    if not runCommand(command):
        return False

    return True


def getHistory(repoPath, fileId):
    command = (
        f'cd "{repoPath}" && '
        f'git log --format=%H refs/heads/file-{fileId}'
    )

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []

    return result.stdout.splitlines()


def restoreVersion(repoPath, fileId, commitHash, filePath):
    command = (
        f'cd "{repoPath}" && '
        f'git checkout {commitHash} -- tracked_file'
    )

    if not runCommand(command):
        return False

    command = (
        f'cp "{repoPath}/tracked_file" '
        f'"{filePath}"'
    )

    if not runCommand(command):
        return False

    command = (
        f'cd "{repoPath}" && '
        f'git restore --staged tracked_file'
    )

    runCommand(command)

    command = f'rm "{repoPath}/tracked_file"'
    runCommand(command)

    return True

