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
    return (Path(folderPath) / ".git").exists()


def trackFolder(folderPath):
    folder = Path(folderPath).expanduser()

    if not folder.exists():
        print("Error: Folder does not exist.")
        return False

    if not folder.is_dir():
        print("Error: Path is not a directory.")
        return False

    if isGitRepository(folder):
        print("Folder is already being tracked.")
        return True

    # Initialize Git repository
    if not executeCommand(
        ["git", "init", str(folder)]
    ):
        return False

    # Add existing files
    if not executeCommand(
        ["git", "add", "."],
        cwd=folder
    ):
        return False

    # Create initial version
    if not executeCommand(
        ["git", "commit", "--allow-empty", "-m", "Initial Version"],
        cwd=folder
    ):
        return False

    return True

def saveFolderVersion(folderPath, message="New folder version"):
    folder = Path(folderPath).expanduser()

    if not isGitRepository(folder):
        print("Error: Folder is not a VersionVault repository.")
        return False

    # Stage all changes inside the folder
    if not executeCommand(
        ["git", "add", "."],
        cwd=folder
    ):
        return False

    # Create the commit
    return executeCommand(
        ["git", "commit", "-m", message],
        cwd=folder
    )


def getFolderHistory(folderPath):
    folder = Path(folderPath).expanduser()

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

# def restoreFolderVersion(folderPath, commitHash):
#     folder = Path(folderPath).expanduser()

#     if not isGitRepository(folder):
#         print("Error: Folder is not a Git repository.")
#         return False

#     if not executeCommand(
#         ["git", "reset", "--hard", commitHash],
#         cwd=folder
#     ):
#         return False

#     return executeCommand(
#         ["git", "clean", "-fd"],
#         cwd=folder
#     )

def restoreFolderVersion(folderPath, commitHash):
    folder = Path(folderPath).expanduser()

    if not isGitRepository(folder):
        print("Error: Folder is not a Git repository.")
        return False

    return executeCommand(
        ["git", "checkout", commitHash, "--", "."],
        cwd=folder
    )


def hasFolderChanged(folderPath):
    folder = Path(folderPath).expanduser()

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