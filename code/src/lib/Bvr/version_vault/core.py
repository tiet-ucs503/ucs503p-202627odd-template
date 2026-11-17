
import subprocess
from pathlib import Path


def runCommand(command):
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return ""

    return result.stdout.rstrip("\n")


def executeCommand(command):
    return subprocess.run(command, shell=True).returncode == 0


def initRepo(repoPath):
    command = f'git init "{repoPath}"'
    return executeCommand(command)


def storeFile(repoPath, filePath):
    command = (
        f'cd "{repoPath}" && '
        f'git hash-object -w "{filePath}"'
    )

    return runCommand(command)


def createTree(repoPath, blobHash, fileName):
    command = (
        f'cd "{repoPath}" && '
        f'printf "100644 blob {blobHash}\\t{fileName}\\n" | git mktree'
    )

    return runCommand(command)


def createCommit(repoPath, treeHash, message, parentCommit=""):
    command = (
        f'cd "{repoPath}" && '
        f'git commit-tree {treeHash}'
    )

    if parentCommit:
        command += f' -p {parentCommit}'

    command += f' -m "{message}"'

    return runCommand(command)


def updateFileRef(repoPath, fileId, commitHash):
    command = (
        f'cd "{repoPath}" && '
        f'git update-ref refs/heads/file-{fileId} {commitHash}'
    )

    return executeCommand(command)


def trackFile(repoPath, fileId, filePath):
    fileName = Path(filePath).name

    blobHash = storeFile(repoPath, filePath)
    if not blobHash:
        return False

    treeHash = createTree(repoPath, blobHash, fileName)
    if not treeHash:
        return False

    commitHash = createCommit(
        repoPath,
        treeHash,
        "Version 1"
    )

    if not commitHash:
        return False

    if not updateFileRef(repoPath, fileId, commitHash):
        return False

    return True


def saveVersion(repoPath, fileId, filePath):
    fileName = Path(filePath).name

    blobHash = storeFile(repoPath, filePath)
    if not blobHash:
        return False

    treeHash = createTree(repoPath, blobHash, fileName)
    if not treeHash:
        return False

    command = (
        f'cd "{repoPath}" && '
        f'git rev-parse refs/heads/file-{fileId}'
    )

    previousCommit = runCommand(command)
    if not previousCommit:
        return False

    commitHash = createCommit(
        repoPath,
        treeHash,
        "New Version",
        previousCommit
    )

    if not commitHash:
        return False

    if not updateFileRef(repoPath, fileId, commitHash):
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


def restoreVersion(repoPath, commitHash, filePath):
    result = subprocess.run(
        ["git", "ls-tree", "--name-only", commitHash],
        cwd=repoPath,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return False

    files = result.stdout.splitlines()

    if not files:
        return False

    fileName = files[0]

    result = subprocess.run(
        ["git", "show", f"{commitHash}:{fileName}"],
        cwd=repoPath,
        capture_output=True
    )

    if result.returncode != 0:
        return False

    try:
        Path(filePath).write_bytes(result.stdout)
        return True
    except OSError:
        return False

