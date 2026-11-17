import subprocess
from pathlib import Path


def runCommand(command, cwd=None):
    result = subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return ""

    return result.stdout.rstrip("\n")


def executeCommand(command, cwd=None):
    return subprocess.run(
        command,
        cwd=cwd
    ).returncode == 0


def isGitRepository(folderPath):
    folder = Path(folderPath).expanduser().resolve()
    return (folder / ".git").exists()


def applyGitIgnore(folderPath):
    folder = Path(folderPath).expanduser().resolve()

    if not isGitRepository(folder):
        print("Error: Folder is not a Git repository.")
        return False

    # Remove tracked files from the Git index without deleting them.
    result = subprocess.run(
        ["git", "rm", "-r", "--cached", "--ignore-unmatch", "."],
        cwd=folder,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("Error updating Git index:", result.stderr)
        return False

    # Re-add files while respecting .gitignore.
    result = subprocess.run(
        ["git", "add", "."],
        cwd=folder,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("Error adding files:", result.stderr)
        return False

    return True


def trackFolder(folderPath):
    folder = Path(folderPath).expanduser().resolve()

    if not folder.exists():
        print("Error: Folder does not exist.")
        return False

    if not folder.is_dir():
        print("Error: Path is not a directory.")
        return False

    if isGitRepository(folder):
        print("Folder is already being tracked.")
        return True

    if not executeCommand(["git", "init", str(folder)]):
        return False

    if not executeCommand(["git", "add", "."], cwd=folder):
        return False

    return executeCommand(
        [
            "git",
            "-c", "user.name=VersionVault",
            "-c", "user.email=versionvault@localhost",
            "commit",
            "--allow-empty",
            "-m", "Initial Version"
        ],
        cwd=folder
    )


def saveFolderVersion(folderPath, message="New folder version"):
    folder = Path(folderPath).expanduser().resolve()

    if not isGitRepository(folder):
        print("Error: Folder is not a VersionVault repository.")
        return False

    if not applyGitIgnore(folder):
        return False

    return executeCommand(
        [
            "git",
            "-c", "user.name=VersionVault",
            "-c", "user.email=versionvault@localhost",
            "commit",
            "-m", message
        ],
        cwd=folder
    )


def getFolderHistory(folderPath):
    folder = Path(folderPath).expanduser().resolve()

    if not isGitRepository(folder):
        print("Error: Folder is not a Git repository.")
        return []

    result = subprocess.run(
        ["git", "log", "--format=%H"],
        cwd=folder,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []

    return result.stdout.splitlines()


def restoreFolderVersion(folderPath, commitHash):
    folder = Path(folderPath).expanduser().resolve()

    if not isGitRepository(folder):
        print("Error: Folder is not a Git repository.")
        return False

    return executeCommand(
        ["git", "checkout", commitHash, "--", "."],
        cwd=folder
    )


def hasFolderChanged(folderPath):
    folder = Path(folderPath).expanduser().resolve()

    if not isGitRepository(folder):
        print("Error: Folder is not a Git repository.")
        return False

    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=folder,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return False

    return bool(result.stdout.strip())