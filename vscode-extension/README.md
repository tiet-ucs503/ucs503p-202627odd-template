# ThreatLens VS Code Extension

AI-powered unified security scanner for code editors. Detects hardcoded secrets, vulnerable dependencies, and insecure code patterns in real-time.

## Features

- **One-Click Workspace Scan**: Analyze your active project with Gitleaks, OSV-Scanner, and Semgrep in a single click.
- **Native Problems Panel Integration**: Vulnerabilities are highlighted directly on line and character coordinates inside your editor.
- **ThreatLens Activity Bar Explorer**: Interactive sidebar grouped by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`) with one-click navigation to code.
- **Remote GitHub Repository Auditing**: Scan any public or private GitHub repository without cloning manually.
- **Interactive Quick Fixes**: View risk explanations and copy recommended remediation code directly from the editor lightbulb menu.

## Extension Settings

This extension contributes the following settings:

* `threatlens.pythonPath`: Custom path to Python executable (defaults to system `python3` / `python`).
* `threatlens.cliPath`: Custom path to `threatlens.py` (automatically discovered if left blank).
* `threatlens.autoScanOnSave`: Run a quick security check automatically whenever a file is saved.
