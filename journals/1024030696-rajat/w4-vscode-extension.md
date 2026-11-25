# Week 4: VS Code Extension Development, Diagnostics & Quick-Fix Actions

**Author**: Rajat (1024030696)  
**Collaborators**: Vidhi (1024030700), Yashti (1024030701)  
**Date**: October 2026

---

## 1. Objectives & Overview

In Week 4, our goal was delivering **Module 2: IDE / Editor Integration** by developing a native VS Code Extension for ThreatLens. 

The extension bridges the developer's editing environment directly with the ThreatLens security engine. Rather than requiring developers to run terminal commands and open separate HTML reports, the extension surfaces security findings directly inside the editor's **Problems panel**, provides an interactive **ThreatLens Sidebar Tree View**, and offers lightbulb **Quick-Fix Code Actions** for instantaneous remediation.

---

## 2. Key Contributions

### A. TypeScript Architecture & Subprocess Communication
- Built the extension codebase in TypeScript (`vscode-extension/src/`):
  - `extension.ts`: Main activation lifecycle, command registrations, status bar shield icon.
  - `engineRunner.ts`: Process spawner invoking `threatlens.py` with `--json --no-open`. Standard output is parsed into structured objects, while progress logs from standard error stream live into the ThreatLens Output Channel.
  - `types.ts`: TypeScript interfaces mirroring our Python JSON contract (`Finding`, `ScanResult`, `ScannerResult`).

### B. Problems Panel Diagnostics (`src/diagnostics.ts`)
- Mapped ThreatLens findings to VS Code `DiagnosticCollection`:
  - Handled 1-based to 0-based coordinate translations (`line - 1`).
  - Mapped findings with `line: null` (e.g., OSV dependency alerts) to line 0 of the manifest file.
  - Normalized severity mapping:
    - `CRITICAL` / `HIGH` ──► `vscode.DiagnosticSeverity.Error`
    - `MEDIUM` ──► `vscode.DiagnosticSeverity.Warning`
    - `LOW` / `INFO` ──► `vscode.DiagnosticSeverity.Information`

### C. Sidebar Tree View & Quick-Fix Actions
- **Sidebar Tree View (`src/treeView.ts`)**:
  - Implemented `vscode.TreeDataProvider` categorizing issues into collapsible groups: Critical, High, Medium, Low, Info.
  - Configured click-to-navigate commands opening the vulnerable file at the exact line and column.
- **Quick-Fix Code Actions (`src/quickFixProvider.ts`)**:
  - Registered a `vscode.CodeActionProvider` responding to diagnostic ranges.
  - Generates a lightbulb Quick Fix action displaying ThreatLens's recommended remediation and documentation links.

### D. Debugging & Resolving the CLI Discovery Bug
During initial testing in VS Code, we encountered:
`[ThreatLens] Could not locate threatlens.py in workspace.`

**Root Cause**: When a subfolder or test repository is opened as the active workspace folder in VS Code, `threatlens.py` is located in a parent sibling folder (`../project a/threatlens.py`). The initial lookup was only searching downward.

**Solution**: I redesigned `findCliPath()` in `engineRunner.ts` to perform multi-directional discovery:
1. Checked workspace configuration setting `threatlens.cliPath`.
2. Queried VS Code's index (`findFiles`).
3. Implemented upward recursive directory traversal (up to 6 levels) starting from open workspace folders, the active text editor's document path, and the extension root.
4. Added fallback to well-known workspace project paths and virtual environment interpreters.

---

## 3. Team Collaboration

- **Collaborating with Vidhi**: Vidhi assisted in integrating the VS Code native GitHub authentication session API (`vscode.authentication.getSession('github', ['repo'])`). This allows users to trigger remote repository scans (`threatlens.scanGitHubRepo`) using their logged-in GitHub account without creating or pasting manual personal access tokens.
- **Collaborating with Yashti**: Yashti created the SVG shield icon for the sidebar and status bar item, and helped test the packaging workflow using `@vscode/vsce package`.

---

## 4. Key Learnings & Outcome

- **Packaging & Testing**: Successfully compiled TypeScript (`npm run compile`), packaged the extension into `threatlens-vscode-0.1.0.vsix`, and installed it into VS Code.
- **Developer Experience**: Real-time editor diagnostics give developers instant feedback as they type or save, preventing insecure code from ever reaching the Git commit stage.
