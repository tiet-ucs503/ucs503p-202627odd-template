import SwiftUI
import AppKit

class AppDelegate: NSObject, NSApplicationDelegate {

    private var timer: Timer?

    private let appGroup =
        "group.com.versionvault.shared"

    // =========================================================
    // APP LAUNCH
    // =========================================================

    func applicationDidFinishLaunching(
        _ notification: Notification
    ) {

        print("================================")
        print("VERSIONVAULT APP")
        print("STARTED")
        print("================================")

        startRequestWatcher()
    }

    // =========================================================
    // REQUEST WATCHER
    //
    // Checks both:
    //
    // pending_request.txt
    //
    // AND
    //
    // history_request.txt
    //
    // History has its own request file so it cannot interfere
    // with Track / Save / Restore requests.
    // =========================================================

    private func startRequestWatcher() {

        timer = Timer.scheduledTimer(
            withTimeInterval: 0.05,
            repeats: true
        ) { [weak self] _ in

            self?.checkForHistoryRequest()
            self?.checkForNormalRequest()
        }

        print("Request watcher started")
    }

    // =========================================================
    // APP GROUP
    // =========================================================

    private func appGroupContainer() -> URL? {

        return FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier:
                appGroup
        )
    }

    // =========================================================
    // HISTORY REQUEST
    //
    // Finder sends:
    //
    // history_request.txt
    //
    // command
    // path
    //
    // We execute:
    //
    // vv history path
    //
    // Then respond with:
    //
    // exact-path
    // hash
    // hash
    // ...
    // =========================================================

    private func checkForHistoryRequest() {

        guard let containerURL =
                appGroupContainer()
        else {
            return
        }

        let requestURL =
            containerURL.appendingPathComponent(
                "history_request.txt"
            )

        guard FileManager.default.fileExists(
            atPath: requestURL.path
        ) else {
            return
        }

        do {

            let contents =
                try String(
                    contentsOf: requestURL,
                    encoding: .utf8
                )

            let lines =
                contents.components(
                    separatedBy: .newlines
                )

            guard lines.count >= 2 else {

                try? FileManager.default.removeItem(
                    at: requestURL
                )

                return
            }

            let command =
                lines[0]
                    .trimmingCharacters(
                        in: .whitespacesAndNewlines
                    )

            let path =
                lines[1]
                    .trimmingCharacters(
                        in: .whitespacesAndNewlines
                    )

            // Remove request BEFORE running CLI.
            try FileManager.default.removeItem(
                at: requestURL
            )

            print("================================")
            print("HISTORY REQUEST RECEIVED")
            print("Command: \(command)")
            print("Path: \(path)")
            print("================================")

            // =================================================
            // Execute history command.
            // =================================================

            let result =
                executeCLI(
                    arguments: [
                        command,
                        path
                    ]
                )

            print("History exit code:")
            print(result.exitCode)

            print("History output:")
            print(result.output)

            // =================================================
            // Extract hashes.
            // =================================================

            let commits =
                extractCommitHashes(
                    from: result.output
                )

            print("Found \(commits.count) commits")

            // =================================================
            // Response.
            //
            // First line MUST be the exact path.
            // This prevents another file's history from being
            // accidentally displayed.
            // =================================================

            let responseURL =
                containerURL.appendingPathComponent(
                    "restore_history_response.txt"
                )

            var response =
                "\(path)\n"

            for commit in commits {
                response += "\(commit)\n"
            }

            try response.write(
                to: responseURL,
                atomically: true,
                encoding: .utf8
            )

            print("================================")
            print("HISTORY RESPONSE WRITTEN")
            print("Path: \(path)")
            print("Versions: \(commits.count)")
            print("================================")

        } catch {

            print("================================")
            print("ERROR HISTORY REQUEST")
            print(error.localizedDescription)
            print("================================")
        }
    }

    // =========================================================
    // NORMAL REQUEST
    //
    // Track
    // Save
    // History
    // Restore
    // Folder commands
    // =========================================================

    private func checkForNormalRequest() {

        guard let containerURL =
                appGroupContainer()
        else {
            return
        }

        let requestURL =
            containerURL.appendingPathComponent(
                "pending_request.txt"
            )

        guard FileManager.default.fileExists(
            atPath: requestURL.path
        ) else {
            return
        }

        do {

            let contents =
                try String(
                    contentsOf: requestURL,
                    encoding: .utf8
                )

            let lines =
                contents.components(
                    separatedBy: .newlines
                )

            guard lines.count >= 2 else {

                try? FileManager.default.removeItem(
                    at: requestURL
                )

                return
            }

            let command =
                lines[0]
                    .trimmingCharacters(
                        in: .whitespacesAndNewlines
                    )

            let path =
                lines[1]
                    .trimmingCharacters(
                        in: .whitespacesAndNewlines
                    )

            let argument: String?

            if lines.count >= 3 {

                let value =
                    lines[2]
                        .trimmingCharacters(
                            in: .whitespacesAndNewlines
                        )

                argument =
                    value.isEmpty
                        ? nil
                        : value

            } else {

                argument = nil
            }

            // Remove request BEFORE executing.
            try FileManager.default.removeItem(
                at: requestURL
            )

            print("================================")
            print("VERSIONVAULT REQUEST RECEIVED")
            print("Command: \(command)")
            print("Path: \(path)")

            if let argument = argument {
                print("Argument: \(argument)")
            }

            print("================================")

            handleCommand(
                command: command,
                path: path,
                argument: argument
            )

        } catch {

            print("================================")
            print("ERROR READING REQUEST")
            print(error.localizedDescription)
            print("================================")
        }
    }

    // =========================================================
    // COMMAND ROUTER
    // =========================================================

    private func handleCommand(
        command: String,
        path: String,
        argument: String?
    ) {

        // =====================================================
        // FILE RESTORE
        //
        // vv restore <commit> <file>
        // =====================================================

        if command == "restore" {

            guard let commit = argument else {

                print(
                    "ERROR: Missing commit hash"
                )

                return
            }

            runCLI(
                arguments: [
                    "restore",
                    commit,
                    path
                ]
            )

            return
        }

        // =====================================================
        // FOLDER RESTORE
        //
        // vv restore-folder <folder> <commit>
        // =====================================================

        if command == "restore-folder" {

            guard let commit = argument else {

                print(
                    "ERROR: Missing commit hash"
                )

                return
            }

            runCLI(
                arguments: [
                    "restore-folder",
                    path,
                    commit
                ]
            )

            return
        }

        // =====================================================
        // SAVE FOLDER
        // =====================================================

        if command == "save-folder" {

            runCLI(
                arguments: [
                    "save-folder",
                    path,
                    argument ?? "New folder version"
                ]
            )

            return
        }

        // =====================================================
        // EVERYTHING ELSE
        //
        // track
        // save
        // history
        // track-folder
        // status
        // history-folder
        // =====================================================

        runCLI(
            arguments: [
                command,
                path
            ]
        )
    }

    // =========================================================
    // EXTRACT COMMIT HASHES
    // =========================================================

    private func extractCommitHashes(
        from output: String
    ) -> [String] {

        var commits: [String] = []

        let lines =
            output.components(
                separatedBy: .newlines
            )

        for line in lines {

            let trimmed =
                line.trimmingCharacters(
                    in: .whitespacesAndNewlines
                )

            guard !trimmed.isEmpty else {
                continue
            }

            // vv history normally gives:
            //
            // 1. abcdef123...
            //
            // Extract the part after "1. "
            // if necessary.

            var candidate = trimmed

            if let dotIndex =
                trimmed.firstIndex(of: ".") {

                let afterDot =
                    trimmed.index(
                        after: dotIndex
                    )

                candidate =
                    String(
                        trimmed[afterDot...]
                    )
                    .trimmingCharacters(
                        in: .whitespaces
                    )
            }

            if isValidCommitHash(candidate) {

                commits.append(candidate)
            }
        }

        return commits
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
    // RUN CLI
    // =========================================================

    private func runCLI(
        arguments: [String]
    ) {

        print("================================")
        print("RUNNING VERSIONVAULT CLI")
        print("================================")

        print("Arguments:")
        print(arguments)

        let result =
            executeCLI(
                arguments: arguments
            )

        print("Exit code:")
        print(result.exitCode)

        print("Output:")
        print(result.output)

        print("================================")
    }

    // =========================================================
    // EXECUTE CLI
    // =========================================================

    private func executeCLI(
        arguments: [String]
    ) -> (
        output: String,
        exitCode: Int32
    ) {

        let process = Process()

        process.executableURL =
            URL(
                fileURLWithPath:
                    "/usr/local/bin/vv"
            )

        // IMPORTANT:
        //
        // We pass arguments directly instead of constructing
        // a shell command. This handles spaces in filenames
        // safely.
        //

        process.arguments = arguments

        let pipe = Pipe()

        process.standardOutput = pipe
        process.standardError = pipe

        do {

            try process.run()

            process.waitUntilExit()

            let data =
                pipe.fileHandleForReading
                    .readDataToEndOfFile()

            let output =
                String(
                    data: data,
                    encoding: .utf8
                ) ?? ""

            return (
                output,
                process.terminationStatus
            )

        } catch {

            return (
                "Failed to execute VersionVault: "
                + error.localizedDescription,
                -1
            )
        }
    }

    // =========================================================
    // APP TERMINATION
    // =========================================================

    func applicationWillTerminate(
        _ notification: Notification
    ) {

        timer?.invalidate()
        timer = nil
    }
}


// ============================================================
// VERSIONVAULT APP
// ============================================================

@main
struct VersionVaultApp: App {

    @NSApplicationDelegateAdaptor(
        AppDelegate.self
    )
    var appDelegate

    var body: some Scene {

        WindowGroup {

            ContentView()
        }
    }
}
