```markdown
# VersionVault

VersionVault is a lightweight version-control system for tracking files and folders, saving versions, viewing version history, and restoring previous versions.

It uses Git plumbing internally for version storage and provides both:

- A command-line interface (CLI)
- A macOS Finder extension for performing VersionVault operations directly from Finder

---

## Features

### Single File Versioning

- Track individual files
- Save new versions
- View version history
- Restore previous versions

### Folder Versioning

- Track complete folders
- Detect changes
- Save folder versions
- View folder version history
- Restore previous folder versions

### Finder Integration

The macOS Finder extension provides VersionVault operations through the Finder right-click menu.

For files:

```text
VersionVault
├── Track
├── Save Version
├── History
└── Restore
    ├── Version 1
    ├── Version 2
    └── Version 3
```

For folders:

```text
VersionVault
├── Track Folder
├── Status
├── Save Folder Version
├── History
└── Restore
    ├── Version 1
    ├── Version 2
    └── Version 3
```

The Restore menu is generated dynamically from the selected item's actual version history.

---

# Project Structure

```text
version-vault/
│
├── code/
│   ├── inc/
│   └── src/
│       ├── bin/
│       │   ├── main.py
│       │   ├── main.cpp
│       │   └── vv
│       │
│       └── lib/
│           └── Bvr/
│               └── version_vault/
│                   ├── core.py
│                   ├── folder_tracker.py
│                   └── database.py
│
├── VersionVaultLauncher/
│   ├── VersionVaultLauncher.xcodeproj
│   ├── VersionVaultLauncher/
│   └── VersionVaultFinderExtension/
│
├── docs/
├── journals/
├── project-proposal/
├── project-report-final/
├── install.sh
├── Makefile
├── README.md
└── .gitignore
```

### Main Components

| Component | Purpose |
|---|---|
| `main.py` | VersionVault CLI entry point |
| `core.py` | Single-file versioning operations |
| `folder_tracker.py` | Folder tracking and versioning |
| `database.py` | SQLite tracking database |
| `vv` | Command-line launcher |
| `FinderSync.swift` | macOS Finder extension |
| `VersionVaultLauncher` | Main macOS application |
| `install.sh` | Installs the `vv` command |

---

# Requirements

VersionVault currently requires:

- macOS
- Xcode
- Python 3
- Git

The Finder integration uses Apple's FinderSync framework and therefore requires macOS.

---

# Installation

Clone the repository:

```bash
git clone https://github.com/Txreex/ucs503p-202627odd-version-vault.git
```

Enter the project directory:

```bash
cd ucs503p-202627odd-version-vault
```

Run the installation script:

```bash
chmod +x install.sh
./install.sh
```

The installation script configures the `vv` command so it points to the VersionVault source in the current project.

Verify the installation:

```bash
vv
```

You should see:

```text
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
```

---

# Running the Finder Extension

Open:

```text
VersionVaultLauncher/VersionVaultLauncher.xcodeproj
```

in Xcode.

Select the `VersionVaultLauncher` scheme and build/run the project.

The project contains:

- `VersionVaultLauncher` — the main macOS application
- `VersionVaultFinderExtension` — the Finder extension

After building the project, enable the VersionVault Finder extension in macOS if required.

Then restart Finder:

```bash
killall Finder
```

You can now right-click files or folders in Finder and access the **VersionVault** menu.

---

# Finder Extension Architecture

The Finder extension does not directly execute the VersionVault CLI.

Instead, communication takes place through a shared App Group.

```text
┌───────────────────────┐
│        Finder         │
│   Right-click Menu    │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│    FinderSync.swift   │
│    Finder Extension   │
└───────────┬───────────┘
            │
            │ App Group
            │
            ▼
┌───────────────────────┐
│ VersionVaultLauncher  │
│      Main App         │
└───────────┬───────────┘
            │
            │ Process
            ▼
┌───────────────────────┐
│   VersionVault CLI    │
│       Python          │
└───────────────────────┘
```

The shared App Group is:

```text
group.com.versionvault.shared
```

The Finder extension and main application use this shared location to exchange requests and responses.

---

# Finder Communication

Normal Finder operations use:

```text
pending_request.txt
```

The request contains:

```text
command
path
optional argument
```

History requests use:

```text
history_request.txt
```

The main application processes the request and returns version information through:

```text
restore_history_response.txt
```

The response contains the selected path followed by the available commit hashes.

This allows the Finder extension to construct the Restore menu dynamically.

---

# Dynamic Restore Menu

When the user opens the Restore menu, the Finder extension requests the current history of the selected item.

For example:

```text
Selected File
     ↓
Request History
     ↓
VersionVault CLI
     ↓
Git History
     ↓
Commit Hashes
     ↓
FinderSync.swift
     ↓
Dynamic Restore Menu
```

Example:

```text
Restore
├── Version 1 — 653bfae15a5f170edbacfddcfc1ebdc96744cfe2
├── Version 2 — 6b5f235c927529e2fa349516d862ac5d6893ab9f
└── Version 3 — b7090806a2528f84495bb13204ac30f243808d8c
```

The history is requested again when the menu is opened, so different files can display their own histories.

---

# Command Line Usage

## Initialize

```bash
vv init
```

## Single Files

Track a file:

```bash
vv track <file-path>
```

Save a new version:

```bash
vv save <file-path>
```

View history:

```bash
vv history <file-path>
```

Restore a version:

```bash
vv restore <commit-hash> <file-path>
```

---

## Folders

Track a folder:

```bash
vv track-folder <folder-path>
```

Check folder status:

```bash
vv status <folder-path>
```

Save a folder version:

```bash
vv save-folder <folder-path> "<message>"
```

View folder history:

```bash
vv history-folder <folder-path>
```

Restore a folder version:

```bash
vv restore-folder <folder-path> <commit-hash>
```

---

# Data Storage

VersionVault uses SQLite to maintain information about tracked items.

The local database is stored at:

```text
~/.versionvault/versionvault.db
```

The database maintains information such as:

- Item ID
- Item type
- File/folder path
- Creation time

Git is used internally for storing file and folder versions.

---

# Version Storage

For individual files, VersionVault uses Git plumbing commands such as:

```text
git hash-object
git mktree
git commit-tree
git update-ref
```

This allows VersionVault to create and maintain version histories without requiring the normal Git workflow from the user.

Folder versioning uses Git repositories associated with the tracked folder.

---

# Security and macOS Integration

The Finder extension runs inside Apple's sandbox.

Because of macOS sandbox restrictions, the Finder extension does not directly execute the VersionVault CLI.

Instead:

```text
Finder Extension
      ↓
App Group
      ↓
VersionVaultLauncher
      ↓
VersionVault CLI
```

The Finder extension uses the application group:

```text
group.com.versionvault.shared
```

This provides the communication mechanism between the Finder extension and the main application.

---

# Development

The main Python source is located in:

```text
code/src/
```

The macOS application and Finder extension are located in:

```text
VersionVaultLauncher/
```

The CLI launcher is:

```text
code/src/bin/vv
```

The launcher determines the project location dynamically, so the project does not depend on a specific user's home directory.

---

# Current Limitations

- Finder integration is currently macOS-specific.
- The Finder extension requires Xcode and macOS.
- VersionVault currently uses Git internally for version storage.
- The CLI and Finder extension need to be installed/configured before use.

---

# Future Improvements

Possible future improvements include:

- Visual version history
- Improved error reporting
- Automatic change detection
- File/folder conflict handling
- More native macOS UI
- Background version monitoring
- Improved restore handling
- Cross-platform CLI support

---

# Project

**VersionVault**

A lightweight version-control system with macOS Finder integration for tracking, saving, viewing, and restoring file and folder versions.
```

### Then do this

Replace your existing `README.md`, save it, and run:

```bash
git status --short
```

Then:

```bash
git add README.md
git commit -m "update project documentation"
git push origin master
```