import * as path from 'path';
import * as vscode from 'vscode';
import { Finding, ScanResultSuccess, SeverityLevel } from './types';

type TreeItemType = 'summary' | 'group' | 'finding';

export class ThreatLensTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: TreeItemType,
    public readonly finding?: Finding,
    public readonly groupSeverity?: SeverityLevel
  ) {
    super(label, collapsibleState);
  }
}

export class ThreatLensTreeDataProvider implements vscode.TreeDataProvider<ThreatLensTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ThreatLensTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ThreatLensTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ThreatLensTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private currentResult: ScanResultSuccess | null = null;
  private workspaceRoot: string = '';

  public refresh(result: ScanResultSuccess | null, workspaceRoot: string = ''): void {
    this.currentResult = result;
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: ThreatLensTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: ThreatLensTreeItem): Thenable<ThreatLensTreeItem[]> {
    if (!this.currentResult) {
      const emptyItem = new ThreatLensTreeItem(
        'No scan results. Click [Scan Workspace] to begin.',
        vscode.TreeItemCollapsibleState.None,
        'summary'
      );
      emptyItem.iconPath = new vscode.ThemeIcon('shield');
      return Promise.resolve([emptyItem]);
    }

    // Root level: Summary + Severity Groups
    if (!element) {
      const items: ThreatLensTreeItem[] = [];

      // Summary Header Item
      const total = this.currentResult.total;
      const summaryText = `Total: ${total} issue${total === 1 ? '' : 's'}`;
      const summaryItem = new ThreatLensTreeItem(
        summaryText,
        vscode.TreeItemCollapsibleState.None,
        'summary'
      );
      summaryItem.description = `Critical: ${this.currentResult.summary['CRITICAL'] || 0} | High: ${this.currentResult.summary['HIGH'] || 0} | Med: ${this.currentResult.summary['MEDIUM'] || 0}`;
      summaryItem.iconPath = new vscode.ThemeIcon('dashboard');
      items.push(summaryItem);

      // Severity group nodes
      const severities: SeverityLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      for (const sev of severities) {
        const count = this.currentResult.summary[sev] || 0;
        if (count > 0) {
          const groupItem = new ThreatLensTreeItem(
            `${sev} (${count})`,
            vscode.TreeItemCollapsibleState.Expanded,
            'group',
            undefined,
            sev
          );
          groupItem.iconPath = this.getSeverityIcon(sev);
          items.push(groupItem);
        }
      }

      return Promise.resolve(items);
    }

    // Children of Severity Group: Findings
    if (element.itemType === 'group' && element.groupSeverity) {
      const groupFindings = this.currentResult.findings.filter(
        (f) => f.severity === element.groupSeverity
      );

      const items = groupFindings.map((f) => {
        const lineInfo = f.line ? `:${f.line}` : '';
        const item = new ThreatLensTreeItem(
          `${f.rule} [${path.basename(f.file)}${lineInfo}]`,
          vscode.TreeItemCollapsibleState.None,
          'finding',
          f
        );
        item.description = f.category;

        const mdTooltip = new vscode.MarkdownString();
        mdTooltip.appendMarkdown(`### ${f.rule} (${f.severity})\n\n`);
        mdTooltip.appendMarkdown(`**File:** \`${f.file}${lineInfo}\`  \n`);
        mdTooltip.appendMarkdown(`**Tool:** ${f.tool}  \n`);
        mdTooltip.appendMarkdown(`**Issue:** ${f.message}\n\n`);
        mdTooltip.appendMarkdown(`**Risk:** ${f.risk}\n\n`);
        mdTooltip.appendMarkdown(`**Fix:** ${f.fix}\n\n`);
        if (f.reference) {
          mdTooltip.appendMarkdown(`[Reference Link](${f.reference})`);
        }
        item.tooltip = mdTooltip;

        item.iconPath = new vscode.ThemeIcon('warning');

        // Command to jump to file & line
        const absPath = path.isAbsolute(f.file)
          ? f.file
          : path.join(this.workspaceRoot || this.currentResult?.scanned_path || '', f.file);

        const targetLine = f.line && f.line > 0 ? f.line - 1 : 0;
        const targetCol = f.column && f.column > 0 ? f.column - 1 : 0;

        item.command = {
          command: 'vscode.open',
          title: 'Jump to Finding',
          arguments: [
            vscode.Uri.file(absPath),
            {
              selection: new vscode.Range(targetLine, targetCol, targetLine, targetCol + 10),
            },
          ],
        };

        return item;
      });

      return Promise.resolve(items);
    }

    return Promise.resolve([]);
  }

  private getSeverityIcon(severity: SeverityLevel): vscode.ThemeIcon {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
      case 'MEDIUM':
        return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
      case 'LOW':
        return new vscode.ThemeIcon('info', new vscode.ThemeColor('editorInfo.foreground'));
      case 'INFO':
      default:
        return new vscode.ThemeIcon('shield');
    }
  }
}
