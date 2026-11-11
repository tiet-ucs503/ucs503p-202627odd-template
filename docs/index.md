![TIET Logo](assets/tiet-logo.svg)

**UCS503: Software Engineering (Project)**  
**TIET Patiala**

# Version Vault

**Author(s):**

Tanay Singh  
Add team members here

## Overview

Version Vault is a file-level versioning system built using Git's internal storage and reference mechanisms.

The system allows users to track individual files, save multiple versions, view version history, and restore previous versions.

Each tracked file maintains an independent version history.

## Features

- Track individual files
- Save multiple versions of a file
- View version history
- Restore previous versions
- Maintain independent histories for multiple files
- Support empty files
- Handle invalid or untracked file IDs gracefully

## How It Works

Each tracked file is associated with a unique file ID.

```text
File
 │
 ▼
File ID
 │
 ▼
refs/heads/file-<fileId>
 │
 ▼
Independent version history
````

Versions are stored using Git's internal object model. File contents are stored as blobs, while tree and commit objects represent versions and their history.

The implementation uses Git plumbing mechanisms rather than normal working-tree operations.

## Current Development

The current implementation focuses on the core file-level versioning engine.

The main operations currently supported are:

* Repository initialization
* File tracking
* Saving new versions
* Retrieving version history
* Restoring previous versions

Folder-level tracking and more advanced file rename or move handling may be explored as future extensions.

## Testing

The project includes test cases for:

* Repository initialization
* Tracking files
* Saving multiple versions
* Version history retrieval
* Restoring previous versions
* Independent histories for different files
* Tracking empty files
* Handling invalid or untracked file IDs

## Development Status

Version Vault is currently under active development as part of the UCS503 Software Engineering Project.
