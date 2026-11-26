import * as vscode from 'vscode';
import { Finding } from './types';

export class ThreatLensQuickFixProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  private findingsByFile: Map<string, Finding[]> = new Map();

  public updateFindings(findings: Finding[], workspaceRoot: string): void {
    this.findingsByFile.clear();
    for (const f of findings) {
      const normalizedPath = f.file.replace(/\\/g, '/');
      const list = this.findingsByFile.get(normalizedPath) || [];
      list.push(f);
      this.findingsByFile.set(normalizedPath, list);
    }
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Filter diagnostics matching ThreatLens
    const threatlensDiagnostics = context.diagnostics.filter((d) =>
      typeof d.source === 'string' && d.source.startsWith('ThreatLens')
    );

    if (threatlensDiagnostics.length === 0) {
      return actions;
    }

    for (const diag of threatlensDiagnostics) {
      // 1. Action: Show Remediation Details
      const explainAction = new vscode.CodeAction(
        `ThreatLens: View Risk & Remediation Details (${diag.code})`,
        vscode.CodeActionKind.QuickFix
      );
      explainAction.diagnostics = [diag];
      explainAction.isPreferred = true;
      explainAction.command = {
        command: 'threatlens.showFindingDetails',
        title: 'Show Finding Details',
        arguments: [diag],
      };
      actions.push(explainAction);

      // 2. Action: Copy Recommendation
      const copyAction = new vscode.CodeAction(
        `ThreatLens: Copy Fix Recommendation`,
        vscode.CodeActionKind.QuickFix
      );
      copyAction.diagnostics = [diag];
      copyAction.command = {
        command: 'threatlens.copyFixRecommendation',
        title: 'Copy Fix Recommendation',
        arguments: [diag.message],
      };
      actions.push(copyAction);
    }

    return actions;
  }
}
