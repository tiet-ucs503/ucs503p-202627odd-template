import sys
import subprocess
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from src.lib.Bvr.version_vault.core import (
    initRepo,
    trackFile,
    saveVersion,
    getHistory,
    restoreVersion
)

from src.lib.Bvr.version_vault.track_folder import (
    trackFolder,
    saveFolderVersion,
    getFolderHistory,
    restoreFolderVersion,
    hasFolderChanged
)

from src.lib.Bvr.version_vault.database import (
    addItem,
    getItemByPath,
    generateItemId
)


REPO_PATH = "/tmp/version_vault_repo"


def executeCommand(command, cwd=None):
    return subprocess.run(
        command,
        cwd=cwd
    ).returncode == 0


def printUsage():
    print("""
VersionVault CLI

Single File Commands:

    vv init
    vv track <file-path>
    vv save <file-path>
    vv history <file-path>
    vv restore <commit-hash> <file-path>

Folder Commands:

    vv track-folder <folder-path>
    vv status <folder-path>
    vv save-folder <folder-path> "<message>"
    vv history-folder <folder-path>
    vv restore-folder <folder-path> <commit-hash>

Ignore Commands:

    vv can-ignore <file-path>
    vv ignore <file-or-folder-path>
    vv ignore <file-or-folder-path> --remove
""")


# ============================================================
# FIND TRACKED PARENT
# ============================================================

def findTrackedParent(selectedPath):
    """
    Walk up the directory tree and find the nearest ancestor
    registered as a tracked VersionVault folder.

    Returns the absolute path of the tracked folder, or None.
    """

    selected = Path(selectedPath).expanduser().resolve()

    if not selected.exists():
        print(f"Error: Path does not exist: {selected}")
        return None

    current = selected if selected.is_dir() else selected.parent

    while True:
        currentPath = str(current)

        item = getItemByPath(currentPath)

        if item and item[1] == "folder":
            return current

        parent = current.parent

        if parent == current:
            break

        current = parent

    print("Error: No tracked VersionVault parent folder found.")
    return None


# ============================================================
# FIND WHETHER A FILE CAN BE IGNORED FROM FINDER
# ============================================================

def canIgnorePath(selectedPath):
    """Return True only for an existing file inside a registered tracked folder."""
    selected = Path(selectedPath).expanduser().resolve()

    if not selected.exists() or not selected.is_file():
        return False

    current = selected.parent

    while True:
        item = getItemByPath(str(current))
        if item and len(item) > 1 and item[1] == "folder":
            return True

        parent = current.parent
        if parent == current:
            return False
        current = parent


# ============================================================
# IGNORE / UNIGNORE
# ============================================================

def updateGitIgnore(selectedPath, remove=False):
    """
    Ignore a selected file or directory inside a tracked folder.

    The selected path can be anywhere inside the tracked folder.
    The CLI resolves the tracked parent automatically.

    Files are removed from Git's index only when they match
    the new ignore rule. They are never deleted from disk.
    """

    selected = Path(selectedPath).expanduser().resolve()

    if not selected.exists():
        print(f"Error: Path does not exist: {selected}")
        return False

    trackedRoot = findTrackedParent(selected)

    if trackedRoot is None:
        return False

    try:
        relativePath = selected.relative_to(trackedRoot)
    except ValueError:
        print("Error: Selected path is outside the tracked folder.")
        return False

    if not relativePath.parts:
        print("Error: Cannot ignore the tracked folder itself.")
        return False

    # Git uses forward slashes in ignore patterns.
    relativePattern = relativePath.as_posix()

    if selected.is_dir():
        # A trailing slash specifies a directory.
        ignorePattern = f"/{relativePattern}/"
    else:
        ignorePattern = f"/{relativePattern}"

    gitignore = trackedRoot / ".gitignore"

    # Read existing .gitignore rules.
    try:
        content = (
            gitignore.read_text(encoding="utf-8")
            if gitignore.exists()
            else ""
        )
    except OSError as error:
        print(f"Error reading .gitignore: {error}")
        return False

    lines = content.splitlines()

    if remove:
        # Remove only the rule created for this exact path.
        updatedLines = [
            line for line in lines
            if line.strip() != ignorePattern
        ]

        if len(updatedLines) == len(lines):
            print(f"Ignore rule not found: {ignorePattern}")
            return False

        updatedContent = "\n".join(updatedLines)

        if updatedContent:
            updatedContent += "\n"

        try:
            gitignore.write_text(
                updatedContent,
                encoding="utf-8"
            )
        except OSError as error:
            print(f"Error updating .gitignore: {error}")
            return False

        if not executeCommand(
            ["git", "add", "--", ".gitignore"],
            cwd=trackedRoot
        ):
            print("Error staging .gitignore.")
            return False

        print(f"Removed ignore rule: {ignorePattern}")
        print("Run vv save-folder to save the change.")

        return True

    # Add the rule if it doesn't already exist.
    if ignorePattern not in lines:
        try:
            with gitignore.open("a", encoding="utf-8") as file:
                if content and not content.endswith("\n"):
                    file.write("\n")

                file.write(ignorePattern + "\n")

        except OSError as error:
            print(f"Error updating .gitignore: {error}")
            return False

        print(f"Added ignore rule: {ignorePattern}")
    else:
        print(f"Ignore rule already exists: {ignorePattern}")

    # Find files that Git currently tracks but now ignores.
    result = subprocess.run(
        [
            "git",
            "ls-files",
            "-ci",
            "--exclude-standard",
            "-z"
        ],
        cwd=trackedRoot,
        capture_output=True
    )

    if result.returncode != 0:
        print("Error checking tracked files.")
        return False

    trackedIgnoredFiles = [
        path.decode("utf-8", errors="surrogateescape")
        for path in result.stdout.split(b"\0")
        if path
    ]

    # Restrict removal to the selected file or selected directory.
    selectedRelative = relativePath.as_posix()

    if selected.is_dir():
        selectedPrefix = selectedRelative.rstrip("/") + "/"

        pathsToUntrack = [
            path for path in trackedIgnoredFiles
            if path == selectedRelative
            or path.startswith(selectedPrefix)
        ]
    else:
        pathsToUntrack = [
            path for path in trackedIgnoredFiles
            if path == selectedRelative
        ]

    # Remove only matching paths from the index.
    # --cached preserves files on the actual filesystem.
    if pathsToUntrack:
        result = subprocess.run(
            [
                "git",
                "rm",
                "-r",
                "--cached",
                "--ignore-unmatch",
                "--",
                *pathsToUntrack
            ],
            cwd=trackedRoot,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print("Error updating Git index:")
            print(result.stderr)
            return False

        print(
            f"Removed {len(pathsToUntrack)} ignored path(s) "
            "from Git's index. Files remain on disk."
        )
    else:
        print("No tracked files needed to be removed from the index.")

    # Stage .gitignore for the next folder version.
    if not executeCommand(
        ["git", "add", "--", ".gitignore"],
        cwd=trackedRoot
    ):
        print("Error staging .gitignore.")
        return False

    print(f"Ignore rule applied to: {selected}")
    print(f"Tracked folder: {trackedRoot}")
    print('Run vv save-folder "<folder>" "<message>" to commit it.')

    return True


# ============================================================
# MAIN CLI
# ============================================================

def main():

    if len(sys.argv) < 2:
        printUsage()
        return 1

    command = sys.argv[1]

    # --------------------------------------------------------
    # INIT
    # --------------------------------------------------------

    if command == "init":

        if initRepo(REPO_PATH):
            print("Repository initialized successfully.")
        else:
            print("Failed to initialize repository.")
            return 1

    # --------------------------------------------------------
    # SINGLE FILE TRACK
    # --------------------------------------------------------

    elif command == "track":

        if len(sys.argv) != 3:
            print("Usage: vv track <file-path>")
            return 1

        filePath = sys.argv[2]

        existingItem = getItemByPath(filePath)

        if existingItem:
            print(
                f"Error: File is already being tracked "
                f"with ID {existingItem[0]}."
            )
            return 1

        fileId = generateItemId("file")

        if not trackFile(REPO_PATH, fileId, filePath):
            print("Failed to track file.")
            return 1

        if not addItem(fileId, "file", filePath):
            print("Failed to register file in database.")
            return 1

        print(f"File tracked successfully with ID: {fileId}")

    # --------------------------------------------------------
    # SINGLE FILE SAVE
    # --------------------------------------------------------

    elif command == "save":

        if len(sys.argv) != 3:
            print("Usage: vv save <file-path>")
            return 1

        filePath = sys.argv[2]
        item = getItemByPath(filePath)

        if not item:
            print("Error: File is not being tracked.")
            return 1

        if item[1] != "file":
            print("Error: Path is not a tracked file.")
            return 1

        if saveVersion(REPO_PATH, item[0], filePath):
            print("New version saved successfully.")
        else:
            print("Failed to save version.")
            return 1

    # --------------------------------------------------------
    # SINGLE FILE HISTORY
    # --------------------------------------------------------

    elif command == "history":

        if len(sys.argv) != 3:
            print("Usage: vv history <file-path>")
            return 1

        filePath = sys.argv[2]
        item = getItemByPath(filePath)

        if not item:
            print("Error: File is not being tracked.")
            return 1

        if item[1] != "file":
            print("Error: Path is not a tracked file.")
            return 1

        history = getHistory(REPO_PATH, item[0])

        if not history:
            print("No version history found.")
            return 0

        print("\nVersion History")
        print("================")

        for i, commit in enumerate(history):
            print(f"{i + 1}. {commit}")

    # --------------------------------------------------------
    # SINGLE FILE RESTORE
    # --------------------------------------------------------

    elif command == "restore":

        if len(sys.argv) != 4:
            print("Usage: vv restore <commit-hash> <file-path>")
            return 1

        commitHash = sys.argv[2]
        filePath = sys.argv[3]

        if restoreVersion(REPO_PATH, commitHash, filePath):
            print("Version restored successfully.")
        else:
            print("Failed to restore version.")
            return 1

    # --------------------------------------------------------
    # FOLDER TRACK
    # --------------------------------------------------------

    elif command == "track-folder":

        if len(sys.argv) != 3:
            print("Usage: vv track-folder <folder-path>")
            return 1

        folderPath = str(Path(sys.argv[2]).expanduser().resolve())
        existingItem = getItemByPath(folderPath)

        if existingItem:
            print(
                f"Error: Folder is already being tracked "
                f"with ID {existingItem[0]}."
            )
            return 1

        if not trackFolder(folderPath):
            print("FAILED: Could not track folder.")
            return 1

        folderId = generateItemId("folder")

        if not addItem(folderId, "folder", folderPath):
            print("FAILED: Could not register folder.")
            return 1

        print(
            f"SUCCESS: Folder is now being tracked "
            f"with ID: {folderId}"
        )

    # --------------------------------------------------------
    # FOLDER STATUS
    # --------------------------------------------------------

    elif command == "status":

        if len(sys.argv) != 3:
            print("Usage: vv status <folder-path>")
            return 1

        folderPath = sys.argv[2]
        item = getItemByPath(folderPath)

        if not item:
            print("Error: Folder is not being tracked.")
            return 1

        if item[1] != "folder":
            print("Error: Path is not a tracked folder.")
            return 1

        if hasFolderChanged(folderPath):
            print("Changes detected.")
        else:
            print("No changes detected.")

    # --------------------------------------------------------
    # FOLDER SAVE
    # --------------------------------------------------------

    elif command == "save-folder":

        if len(sys.argv) != 4:
            print('Usage: vv save-folder <folder-path> "<message>"')
            return 1

        folderPath = sys.argv[2]
        message = sys.argv[3]

        item = getItemByPath(folderPath)

        if not item:
            print("Error: Folder is not being tracked.")
            return 1

        if item[1] != "folder":
            print("Error: Path is not a tracked folder.")
            return 1

        if saveFolderVersion(folderPath, message):
            print("SUCCESS: Folder version saved.")
        else:
            print("FAILED: Could not save version.")
            return 1

    # --------------------------------------------------------
    # FOLDER HISTORY
    # --------------------------------------------------------

    elif command == "history-folder":

        if len(sys.argv) != 3:
            print("Usage: vv history-folder <folder-path>")
            return 1

        folderPath = sys.argv[2]
        item = getItemByPath(folderPath)

        if not item:
            print("Error: Folder is not being tracked.")
            return 1

        if item[1] != "folder":
            print("Error: Path is not a tracked folder.")
            return 1

        history = getFolderHistory(folderPath)

        if not history:
            print("No versions found.")
            return 0

        print("\nFolder Version History")
        print("======================")

        for i, commit in enumerate(history):
            print(f"{i + 1}. {commit}")

    # --------------------------------------------------------
    # FOLDER RESTORE
    # --------------------------------------------------------

    elif command == "restore-folder":

        if len(sys.argv) != 4:
            print(
                "Usage: vv restore-folder "
                "<folder-path> <commit-hash>"
            )
            return 1

        folderPath = sys.argv[2]
        commitHash = sys.argv[3]

        item = getItemByPath(folderPath)

        if not item:
            print("Error: Folder is not being tracked.")
            return 1

        if item[1] != "folder":
            print("Error: Path is not a tracked folder.")
            return 1

        if restoreFolderVersion(folderPath, commitHash):
            print("SUCCESS: Folder restored.")
        else:
            print("FAILED: Could not restore version.")
            return 1

    # --------------------------------------------------------
    # FINDER IGNORE ELIGIBILITY CHECK
    # Prints exactly true/false for the Swift request handler.
    # --------------------------------------------------------

    elif command == "can-ignore":

        if len(sys.argv) != 3:
            print("false")
            return 1

        eligible = canIgnorePath(sys.argv[2])
        print("true" if eligible else "false")
        return 0 if eligible else 1

    # --------------------------------------------------------
    # IGNORE / UNIGNORE
    # --------------------------------------------------------

    elif command == "ignore":

        if len(sys.argv) not in (3, 4):
            print(
                "Usage: vv ignore <file-or-folder-path> [--remove]"
            )
            return 1

        selectedPath = sys.argv[2]

        if len(sys.argv) == 4 and sys.argv[3] != "--remove":
            print("Error: The only supported option is --remove.")
            return 1

        remove = len(sys.argv) == 4

        if not updateGitIgnore(selectedPath, remove):
            return 1

    # --------------------------------------------------------
    # UNKNOWN COMMAND
    # --------------------------------------------------------

    else:
        print(f"Unknown command: {command}")
        printUsage()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())