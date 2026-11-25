import * as vscode from 'vscode';
import { DiagnosticsManager } from './diagnostics';
import { EngineRunner } from './engineRunner';
import { ThreatLensQuickFixProvider } from './quickFixProvider';
import { ThreatLensTreeDataProvider } from './treeView';
import { ScanResultSuccess } from './types';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let diagnosticsManager: DiagnosticsManager;
let treeDataProvider: ThreatLensTreeDataProvider;
let quickFixProvider: ThreatLensQuickFixProvider;
let engineRunner: EngineRunner;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('ThreatLens');
  context.subscriptions.push(outputChannel);

  engineRunner = new EngineRunner(outputChannel);
  diagnosticsManager = new DiagnosticsManager();
  context.subscriptions.push(diagnosticsManager);

  treeDataProvider = new ThreatLensTreeDataProvider();
  vscode.window.registerTreeDataProvider('threatlens-findings-view', treeDataProvider);

  quickFixProvider = new ThreatLensQuickFixProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: 'file' },
      quickFixProvider,
      {
        providedCodeActionKinds: ThreatLensQuickFixProvider.providedCodeActionKinds,
      }
    )
  );

  // Status Bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'threatlens.scanWorkspace';
  statusBarItem.text = '$(shield) ThreatLens';
  statusBarItem.tooltip = 'Click to scan workspace with ThreatLens';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('threatlens.scanWorkspace', () => scanWorkspaceCommand()),
    vscode.commands.registerCommand('threatlens.scanGitHubRepo', () => scanGitHubRepoCommand()),
    vscode.commands.registerCommand('threatlens.clearFindings', () => clearFindingsCommand()),
    vscode.commands.registerCommand('threatlens.showOutput', () => outputChannel.show()),
    vscode.commands.registerCommand('threatlens.showFindingDetails', (diag: vscode.Diagnostic) => {
      vscode.window.showInformationMessage(diag.message, { modal: true });
    }),
    vscode.commands.registerCommand('threatlens.copyFixRecommendation', (message: string) => {
      const fixIndex = message.indexOf('Fix: ');
      const fixText = fixIndex !== -1 ? message.substring(fixIndex + 5) : message;
      vscode.env.clipboard.writeText(fixText);
      vscode.window.showInformationMessage('ThreatLens: Remediation copied to clipboard.');
    })
  );

  // Auto scan on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
      const config = vscode.workspace.getConfiguration('threatlens');
      if (config.get<boolean>('autoScanOnSave', false)) {
        scanWorkspaceCommand(true);
      }
    })
  );

  outputChannel.appendLine('ThreatLens Extension activated successfully.');
}

async function scanWorkspaceCommand(silent: boolean = false) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage('ThreatLens: Please open a workspace folder to scan.');
    return;
  }

  const workspaceRoot = folders[0].uri.fsPath;

  statusBarItem.text = '$(sync~spin) ThreatLens: Scanning...';
  statusBarItem.tooltip = 'ThreatLens scan in progress...';

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ThreatLens: Running security scan...',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Running Gitleaks, OSV-Scanner, and Semgrep...' });
        const result = await engineRunner.scanLocal(workspaceRoot);

        if (result.status === 'ok') {
          handleSuccessfulScan(result, workspaceRoot, silent);
        }
      }
    );
  } catch (err: any) {
    statusBarItem.text = '$(error) ThreatLens: Error';
    statusBarItem.tooltip = 'Last scan failed. Click to view logs.';
    statusBarItem.command = 'threatlens.showOutput';
    vscode.window.showErrorMessage(`ThreatLens Scan Failed: ${err.message}`, 'View Logs').then((sel) => {
      if (sel === 'View Logs') {
        outputChannel.show();
      }
    });
  }
}

async function scanGitHubRepoCommand() {
  const repoInput = await vscode.window.showInputBox({
    prompt: 'Enter GitHub repository (e.g. owner/repo or full URL)',
    placeHolder: 'owner/repo',
  });

  if (!repoInput) {
    return;
  }

  // Seamless GitHub authentication using VS Code session
  let token: string | undefined;
  try {
    const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
    if (session) {
      token = session.accessToken;
      outputChannel.appendLine(`[ThreatLens] Using VS Code authenticated GitHub session (${session.account.label})`);
    }
  } catch (authErr) {
    outputChannel.appendLine('[ThreatLens] No active VS Code GitHub session found; proceeding without session token.');
  }

  // Branch picker
  let selectedBranch: string | undefined;
  try {
    statusBarItem.text = '$(sync~spin) Fetching branches...';
    const branchRes = await engineRunner.listBranches(repoInput, token);
    if (branchRes.status === 'ok' && branchRes.branches && branchRes.branches.length > 0) {
      const pick = await vscode.window.showQuickPick(branchRes.branches, {
        placeHolder: `Select branch to scan (default: ${branchRes.default_branch})`,
      });
      selectedBranch = pick;
    }
  } catch {
    // If listing branches fails, fall back to default branch
  }

  statusBarItem.text = '$(sync~spin) ThreatLens: Scanning GitHub...';

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `ThreatLens: Scanning ${repoInput}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Cloning and analyzing repository...' });
        const result = await engineRunner.scanGitHub(repoInput, selectedBranch, token);

        if (result.status === 'ok') {
          handleSuccessfulScan(result, result.scanned_path);
        }
      }
    );
  } catch (err: any) {
    statusBarItem.text = '$(error) ThreatLens: Error';
    vscode.window.showErrorMessage(`ThreatLens Remote Scan Failed: ${err.message}`, 'View Logs').then((sel) => {
      if (sel === 'View Logs') {
        outputChannel.show();
      }
    });
  }
}

function handleSuccessfulScan(result: ScanResultSuccess, rootPath: string, silent: boolean = false) {
  diagnosticsManager.updateDiagnostics(result, rootPath);
  treeDataProvider.refresh(result, rootPath);
  quickFixProvider.updateFindings(result.findings, rootPath);

  const total = result.total;
  const critical = result.summary['CRITICAL'] || 0;
  const high = result.summary['HIGH'] || 0;

  if (critical > 0 || high > 0) {
    statusBarItem.text = `$(alert) ThreatLens: ${total} Issues (${critical} Crit, ${high} High)`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (total > 0) {
    statusBarItem.text = `$(warning) ThreatLens: ${total} Issues`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.text = `$(check) ThreatLens: Clean`;
    statusBarItem.backgroundColor = undefined;
  }
  statusBarItem.tooltip = `Scan complete. Total: ${total} issues. Click to rescan.`;
  statusBarItem.command = 'threatlens.scanWorkspace';

  if (!silent) {
    if (total === 0) {
      vscode.window.showInformationMessage('ThreatLens: No security issues detected. Repository is clean!');
    } else {
      const msg = `ThreatLens: Found ${total} security issues (${critical} Critical, ${high} High). Check Problems panel.`;
      vscode.window.showWarningMessage(msg, 'View Problems').then((sel) => {
        if (sel === 'View Problems') {
          vscode.commands.executeCommand('workbench.actions.view.problems');
        }
      });
    }
  }
}

function clearFindingsCommand() {
  diagnosticsManager.clear();
  treeDataProvider.refresh(null);
  statusBarItem.text = '$(shield) ThreatLens';
  statusBarItem.backgroundColor = undefined;
  statusBarItem.tooltip = 'Click to scan workspace with ThreatLens';
  vscode.window.showInformationMessage('ThreatLens: Findings cleared.');
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  if (diagnosticsManager) {
    diagnosticsManager.dispose();
  }
}
