import sys
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
""")


def main():

    if len(sys.argv) < 2:
        printUsage()
        return 1

    command = sys.argv[1]

    # ========================================================
    # INIT
    # ========================================================

    # vv init
    if command == "init":

        if initRepo(REPO_PATH):
            print("Repository initialized successfully.")
        else:
            print("Failed to initialize repository.")

    # ========================================================
    # SINGLE FILE TRACK
    # ========================================================

    # vv track <file-path>
    elif command == "track":

        if len(sys.argv) != 3:
            print("Usage: vv track <file-path>")
            return 1

        filePath = sys.argv[2]

        # Check whether this file is already tracked
        existingItem = getItemByPath(filePath)

        if existingItem:
            print(
                f"Error: File is already being tracked "
                f"with ID {existingItem[0]}."
            )
            return 1

        # Generate VersionVault ID
        fileId = generateItemId("file")

        # Track the file using Git
        if not trackFile(
            REPO_PATH,
            fileId,
            filePath
        ):
            print("Failed to track file.")
            return 1

        # Store metadata in SQLite
        if not addItem(
            fileId,
            "file",
            filePath
        ):
            print("Failed to register file in database.")
            return 1

        print(
            f"File tracked successfully with ID: {fileId}"
        )

    # ========================================================
    # SINGLE FILE SAVE
    # ========================================================

    # vv save <file-path>
    elif command == "save":

        if len(sys.argv) != 3:
            print("Usage: vv save <file-path>")
            return 1

        filePath = sys.argv[2]

        # Find the VersionVault ID using the path
        item = getItemByPath(filePath)

        if not item:
            print("Error: File is not being tracked.")
            return 1

        if item[1] != "file":
            print("Error: Path is not a tracked file.")
            return 1

        fileId = item[0]

        if saveVersion(
            REPO_PATH,
            fileId,
            filePath
        ):
            print("New version saved successfully.")
        else:
            print("Failed to save version.")

    # ========================================================
    # SINGLE FILE HISTORY
    # ========================================================

    # vv history <file-path>
    elif command == "history":

        if len(sys.argv) != 3:
            print("Usage: vv history <file-path>")
            return 1

        filePath = sys.argv[2]

        # Find the VersionVault ID
        item = getItemByPath(filePath)

        if not item:
            print("Error: File is not being tracked.")
            return 1

        if item[1] != "file":
            print("Error: Path is not a tracked file.")
            return 1

        fileId = item[0]

        history = getHistory(
            REPO_PATH,
            fileId
        )

        if not history:
            print("No version history found.")
            return 0

        print("\nVersion History")
        print("================")

        for i, commit in enumerate(history):
            print(f"{i + 1}. {commit}")

    # ========================================================
    # SINGLE FILE RESTORE
    # ========================================================

    # vv restore <commit-hash> <file-path>
    elif command == "restore":

        if len(sys.argv) != 4:
            print(
                "Usage: vv restore "
                "<commit-hash> <file-path>"
            )
            return 1

        commitHash = sys.argv[2]
        filePath = sys.argv[3]

        # Make sure the file is tracked


        if restoreVersion(
            REPO_PATH,
            commitHash,
            filePath
        ):
            print("Version restored successfully.")
        else:
            print("Failed to restore version.")

    # ========================================================
    # FOLDER TRACK
    # ========================================================m

    # vv track-folder <folder-path>
    elif command == "track-folder":

        if len(sys.argv) != 3:
            print("Usage: vv track-folder <folder-path>")
            return 1

        folderPath = sys.argv[2]

        # Check if folder is already tracked
        existingItem = getItemByPath(folderPath)

        if existingItem:
            print(
                f"Error: Folder is already being tracked "
                f"with ID {existingItem[0]}."
            )
            return 1

        # Initialize Git inside the folder
        if not trackFolder(folderPath):
            print("FAILED: Could not track folder.")
            return 1

        # Generate VersionVault folder ID
        folderId = generateItemId("folder")

        # Store folder metadata
        if not addItem(
            folderId,
            "folder",
            folderPath
        ):
            print("FAILED: Could not register folder.")
            return 1

        print(
            f"SUCCESS: Folder is now being tracked "
            f"with ID: {folderId}"
        )

    # ========================================================
    # FOLDER STATUS
    # ========================================================

    # vv status <folder-path>
    elif command == "status":

        if len(sys.argv) != 3:
            print("Usage: vv status <folder-path>")
            return 1

        folderPath = sys.argv[2]

        # Make sure folder is tracked
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

    # ========================================================
    # FOLDER SAVE
    # ========================================================

    # vv save-folder <folder-path> "<message>"
    elif command == "save-folder":

        if len(sys.argv) != 4:
            print(
                'Usage: vv save-folder '
                '<folder-path> "<message>"'
            )
            return 1

        folderPath = sys.argv[2]
        message = sys.argv[3]

        # Make sure folder is tracked
        item = getItemByPath(folderPath)

        if not item:
            print("Error: Folder is not being tracked.")
            return 1

        if item[1] != "folder":
            print("Error: Path is not a tracked folder.")
            return 1

        if saveFolderVersion(
            folderPath,
            message
        ):
            print("SUCCESS: Folder version saved.")
        else:
            print("FAILED: Could not save version.")

    # ========================================================
    # FOLDER HISTORY
    # ========================================================

    # vv history-folder <folder-path>
    elif command == "history-folder":

        if len(sys.argv) != 3:
            print(
                "Usage: vv history-folder "
                "<folder-path>"
            )
            return 1

        folderPath = sys.argv[2]

        # Make sure folder is tracked
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

    # ========================================================
    # FOLDER RESTORE
    # ========================================================

    # vv restore-folder <folder-path> <commit-hash>
    elif command == "restore-folder":

        if len(sys.argv) != 4:
            print(
                "Usage: vv restore-folder "
                "<folder-path> <commit-hash>"
            )
            return 1

        folderPath = sys.argv[2]
        commitHash = sys.argv[3]

        # Make sure folder is tracked
        item = getItemByPath(folderPath)

        if not item:
            print("Error: Folder is not being tracked.")
            return 1

        if item[1] != "folder":
            print("Error: Path is not a tracked folder.")
            return 1

        if restoreFolderVersion(
            folderPath,
            commitHash
        ):
            print("SUCCESS: Folder restored.")
        else:
            print("FAILED: Could not restore version.")

    # ========================================================
    # UNKNOWN COMMAND
    # ========================================================

    else:
        print(f"Unknown command: {command}")
        printUsage()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())