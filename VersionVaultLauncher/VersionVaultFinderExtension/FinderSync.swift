import Cocoa

import FinderSync

class FinderSync: FIFinderSync {

    private let appGroup = "group.com.versionvault.shared"

    override init() {

        super.init()

        FIFinderSyncController.default().directoryURLs = [

            URL(fileURLWithPath: "/")

        ]

        print("================================")

        print("VERSIONVAULT FINDER EXTENSION")

        print("STARTED")

        print("================================")

    }

    // =========================================================

    // MENU

    // =========================================================

    override func menu(for menuKind: FIMenuKind) -> NSMenu? {

        guard menuKind == .contextualMenuForItems else {

            return nil

        }

        guard let selectedURL = selectedItem() else {

            return nil

        }

        let isFolder = isDirectory(selectedURL)

        print("================================")

        print("VERSIONVAULT CONTEXT MENU")

        print("Path:")

        print(selectedURL.path)

        print("Is folder:")

        print(isFolder)

        print("================================")

        let menu = NSMenu()

        // =====================================================

        // VERSIONVAULT

        // =====================================================

        let versionVaultItem = NSMenuItem(

            title: "VersionVault",

            action: nil,

            keyEquivalent: ""

        )

        let versionVaultMenu = NSMenu(

            title: "VersionVault"

        )

        versionVaultItem.submenu = versionVaultMenu

        menu.addItem(versionVaultItem)

        // =====================================================

        // FILE OPTIONS

        // =====================================================

        if !isFolder {

            addItem(

                to: versionVaultMenu,

                title: "Track",

                action: #selector(trackAction)

            )

            addItem(

                to: versionVaultMenu,

                title: "Save Version",

                action: #selector(saveAction)

            )

            addItem(

                to: versionVaultMenu,

                title: "History",

                action: #selector(historyAction)

            )

        } else {

            // =================================================

            // FOLDER OPTIONS

            // =================================================

            addItem(

                to: versionVaultMenu,

                title: "Track Folder",

                action: #selector(trackFolderAction)

            )

            addItem(

                to: versionVaultMenu,

                title: "Status",

                action: #selector(statusAction)

            )

            addItem(

                to: versionVaultMenu,

                title: "Save Folder Version",

                action: #selector(saveFolderAction)

            )

            addItem(

                to: versionVaultMenu,

                title: "History",

                action: #selector(historyFolderAction)

            )

        }

        versionVaultMenu.addItem(

            NSMenuItem.separator()

        )

        // =====================================================

        // RESTORE SUBMENU

        //

        // Fresh history is fetched every time Finder creates

        // this menu.

        // =====================================================

        let restoreItem = NSMenuItem(

            title: "Restore",

            action: nil,

            keyEquivalent: ""

        )

        let restoreMenu = NSMenu(

            title: "Restore"

        )

        restoreItem.submenu = restoreMenu

        print("================================")

        print("REQUESTING FRESH HISTORY")

        print("Path:")

        print(selectedURL.path)

        print("================================")

        let commits = requestHistorySynchronously(

            path: selectedURL.path,

            isFolder: isFolder

        )

        print("================================")

        print("HISTORY RECEIVED")

        print("Versions: \(commits.count)")

        print("================================")

        // =====================================================

        // BUILD RESTORE MENU

        //

        // commits has already been reversed in

        // requestHistorySynchronously().

        //

        // Therefore:

        //

        // Version 1 = oldest

        // Version 2 = newer

        // Version N = newest

        // =====================================================

        if commits.isEmpty {

            let emptyItem = NSMenuItem(

                title: "No versions found",

                action: nil,

                keyEquivalent: ""

            )

            emptyItem.isEnabled = false

            restoreMenu.addItem(emptyItem)

        } else {

            for (index, commit) in commits.enumerated() {

                let title =

                    "Version \(index + 1)  \(commit)"

                let item = NSMenuItem(

                    title: title,

                    action: #selector(

                        restoreVersionAction(_:)

                    ),

                    keyEquivalent: ""

                )

                item.target = self

                // Keep the hash here too.

                // The click handler uses the title directly

                // because Finder can copy menu items.

                item.representedObject = commit

                restoreMenu.addItem(item)

                print("Added restore version:")

                print(title)

            }

        }

        versionVaultMenu.addItem(

            restoreItem

        )

        return menu

    }

    // =========================================================

    // ADD MENU ITEM

    // =========================================================

    private func addItem(

        to menu: NSMenu,

        title: String,

        action: Selector

    ) {

        let item = NSMenuItem(

            title: title,

            action: action,

            keyEquivalent: ""

        )

        item.target = self

        menu.addItem(item)

    }

    // =========================================================

    // SELECTED ITEM

    // =========================================================

    private func selectedItem() -> URL? {

        return FIFinderSyncController

            .default()

            .selectedItemURLs()?

            .first

    }

    // =========================================================

    // CHECK DIRECTORY

    // =========================================================

    private func isDirectory(

        _ url: URL

    ) -> Bool {

        var isDir: ObjCBool = false

        FileManager.default.fileExists(

            atPath: url.path,

            isDirectory: &isDir

        )

        return isDir.boolValue

    }

    // =========================================================

    // APP GROUP CONTAINER

    // =========================================================

    private func appGroupContainer() -> URL? {

        return FileManager.default.containerURL(

            forSecurityApplicationGroupIdentifier:

                appGroup

        )

    }

    // =========================================================

    // REQUEST HISTORY SYNCHRONOUSLY

    //

    // Finder:

    //

    // history_request.txt

    //

    // Main app:

    //

    // vv history \<path>

    //

    // Main app:

    //

    // restore_history_response.txt

    //

    // Finder:

    //

    // reads hashes

    //

    // IMPORTANT:

    //

    // Git returns newest -> oldest.

    // We reverse it before returning so the UI shows:

    //

    // oldest -> newest

    // =========================================================

    private func requestHistorySynchronously(

        path: String,

        isFolder: Bool

    ) -> [String] {

        guard let containerURL =

                appGroupContainer()

        else {

            print(

                "ERROR: App Group unavailable"

            )

            return []

        }

        let requestURL =

            containerURL.appendingPathComponent(

                "history_request.txt"

            )

        let responseURL =

            containerURL.appendingPathComponent(

                "restore_history_response.txt"

            )

        // =====================================================

        // Remove old response.

        // =====================================================

        try? FileManager.default.removeItem(

            at: responseURL

        )

        // =====================================================

        // Remove old request.

        // =====================================================

        try? FileManager.default.removeItem(

            at: requestURL

        )

        // =====================================================

        // Select history command.

        // =====================================================

        let command =

            isFolder

                ? "history-folder"

                : "history"

        let requestContents =

            "\(command)\n\(path)"

        // =====================================================

        // Write request.

        // =====================================================

        do {

            try requestContents.write(

                to: requestURL,

                atomically: true,

                encoding: .utf8

            )

        } catch {

            print(

                "ERROR WRITING HISTORY REQUEST:"

            )

            print(

                error.localizedDescription

            )

            return []

        }

        print("================================")

        print("HISTORY REQUEST SENT")

        print("Command: \(command)")

        print("Path:")

        print(path)

        print("================================")

        // =====================================================

        // Wait for response.

        // =====================================================

        let timeout: TimeInterval = 3.0

        let startTime = Date()

        while Date().timeIntervalSince(startTime)

                < timeout {

            if FileManager.default.fileExists(

                atPath: responseURL.path

            ) {

                guard let response =

                        try? String(

                            contentsOf: responseURL,

                            encoding: .utf8

                        )

                else {

                    break

                }

                let lines =

                    response.components(

                        separatedBy: .newlines

                    )

                guard !lines.isEmpty else {

                    break

                }

                // =================================================

                // Verify exact file path.

                // =================================================

                let responsePath =

                    lines[0]

                        .trimmingCharacters(

                            in: .whitespacesAndNewlines

                        )

                guard responsePath == path else {

                    print(

                        "ERROR: HISTORY RESPONSE PATH MISMATCH"

                    )

                    print("Expected:")

                    print(path)

                    print("Received:")

                    print(responsePath)

                    try? FileManager.default.removeItem(

                        at: responseURL

                    )

                    return []

                }

                // =================================================

                // Extract hashes.

                // =================================================

                var commits: [String] = []

                for line in lines.dropFirst() {

                    let hash =

                        line.trimmingCharacters(

                            in: .whitespacesAndNewlines

                        )

                    if isValidCommitHash(hash) {

                        commits.append(hash)

                    }

                }

                // =================================================

                // Delete response.

                // =================================================

                try? FileManager.default.removeItem(

                    at: responseURL

                )

                print("================================")

                print("HISTORY RESPONSE ACCEPTED")

                print("Path:")

                print(path)

                print("Versions:")

                print(commits.count)

                print("================================")

                // =================================================

                // IMPORTANT:

                //

                // git log returns:

                //

                // newest

                // older

                // oldest

                //

                // Reverse it for VersionVault:

                //

                // Version 1 = oldest

                // Version N = newest

                // =================================================

                return Array(

                    commits.reversed()

                )

            }

            // =================================================

            // Small wait.

            // =================================================

            Thread.sleep(

                forTimeInterval: 0.05

            )

        }

        // =====================================================

        // Timeout.

        // =====================================================

        print("================================")

        print("HISTORY REQUEST TIMED OUT")

        print("Path:")

        print(path)

        print("================================")

        try? FileManager.default.removeItem(

            at: responseURL

        )

        return []

    }

    // =========================================================

    // VALID COMMIT HASH

    // =========================================================

    private func isValidCommitHash(

        _ hash: String

    ) -> Bool {

        guard hash.count == 40 else {

            return false

        }

        return hash.allSatisfy { character in

            character.isNumber ||

            (

                character >= "a" &&

                character <= "f"

            ) ||

            (

                character >= "A" &&

                character <= "F"

            )

        }

    }

    // =========================================================

    // TRACK FILE

    // =========================================================

    @objc

    func trackAction() {

        guard let item = selectedItem()

        else {

            return

        }

        print("TRACK CLICKED")

        writeRequest(

            command: "track",

            path: item.path

        )

    }

    // =========================================================

    // SAVE FILE VERSION

    // =========================================================

    @objc

    func saveAction() {

        guard let item = selectedItem()

        else {

            return

        }

        print("SAVE VERSION CLICKED")

        writeRequest(

            command: "save",

            path: item.path

        )

    }

    // =========================================================

    // FILE HISTORY

    // =========================================================

    @objc

    func historyAction() {

        guard let item = selectedItem()

        else {

            return

        }

        print("HISTORY CLICKED")

        writeRequest(

            command: "history",

            path: item.path

        )

    }

    // =========================================================

    // TRACK FOLDER

    // =========================================================

    @objc

    func trackFolderAction() {

        guard let item = selectedItem()

        else {

            return

        }

        print("TRACK FOLDER CLICKED")

        writeRequest(

            command: "track-folder",

            path: item.path

        )

    }

    // =========================================================

    // FOLDER STATUS

    // =========================================================

    @objc

    func statusAction() {

        guard let item = selectedItem()

        else {

            return

        }

        print("STATUS CLICKED")

        writeRequest(

            command: "status",

            path: item.path

        )

    }

    // =========================================================

    // SAVE FOLDER VERSION

    // =========================================================

    @objc

    func saveFolderAction() {

        guard let item = selectedItem()

        else {

            return

        }

        print("SAVE FOLDER VERSION CLICKED")

        writeRequest(

            command: "save-folder",

            path: item.path

        )

    }

    // =========================================================

    // FOLDER HISTORY

    // =========================================================

    @objc

    func historyFolderAction() {

        guard let item = selectedItem()

        else {

            return

        }

        print("FOLDER HISTORY CLICKED")

        writeRequest(

            command: "history-folder",

            path: item.path

        )

    }

    // =========================================================

    // RESTORE VERSION

    //

    // Example menu item:

    //

    // Version 1  4158d4042293b2fd7d2445435b89ad612005c7b6

    //

    // We extract the LAST value as the commit hash.

    //

    // This avoids relying on representedObject because Finder

    // can copy NSMenuItems internally.

    // =========================================================

    @objc
    func restoreVersionAction(
        _ sender: NSMenuItem
    ) {
        print("================================")
        print("RESTORE CLICKED")
        print("================================")

        let title = sender.title

        print("Clicked menu item:")
        print(title)

        let parts =
            title.components(
                separatedBy: .whitespaces
            )
            .filter {
                !$0.isEmpty
            }

        guard let commit = parts.last else {
            print("ERROR: Could not extract commit hash")
            return
        }

        guard isValidCommitHash(commit) else {
            print("ERROR: Invalid commit hash:")
            print(commit)
            return
        }

        guard let item = selectedItem() else {
            print("ERROR: No selected item")
            return
        }

        let path = item.path
        let isFolder = isDirectory(item)

        print("================================")
        print("RESTORE INFORMATION")
        print("Commit:")
        print(commit)
        print("Path:")
        print(path)
        print("Is folder:")
        print(isFolder)
        print("================================")

        let restoreCommand =
            isFolder
                ? "restore-folder"
                : "restore"

        writeRequest(
            command: restoreCommand,
            path: path,
            argument: commit
        )
    }
    // WRITE NORMAL REQUEST

    // =========================================================

    private func writeRequest(

        command: String,

        path: String,

        argument: String? = nil

    ) {

        guard let containerURL =

                appGroupContainer()

        else {

            print(

                "ERROR: App Group unavailable"

            )

            return

        }

        let requestURL =

            containerURL.appendingPathComponent(

                "pending_request.txt"

            )

        var contents =

            "\(command)\n\(path)"

        if let argument = argument {

            contents +=

                "\n\(argument)"

        }

        do {

            try contents.write(

                to: requestURL,

                atomically: true,

                encoding: .utf8

            )

            print("================================")

            print("VERSIONVAULT REQUEST")

            print("Command:")

            print(command)

            print("Path:")

            print(path)

            if let argument = argument {

                print("Argument:")

                print(argument)

            }

            print("================================")

        } catch {

            print(

                "ERROR WRITING REQUEST:"

            )

            print(

                error.localizedDescription

            )

        }

    }

}
