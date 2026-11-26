"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreatLensTreeDataProvider = exports.ThreatLensTreeItem = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class ThreatLensTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    itemType;
    finding;
    groupSeverity;
    constructor(label, collapsibleState, itemType, finding, groupSeverity) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.itemType = itemType;
        this.finding = finding;
        this.groupSeverity = groupSeverity;
    }
}
exports.ThreatLensTreeItem = ThreatLensTreeItem;
class ThreatLensTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    currentResult = null;
    workspaceRoot = '';
    refresh(result, workspaceRoot = '') {
        this.currentResult = result;
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.currentResult) {
            const emptyItem = new ThreatLensTreeItem('No scan results. Click [Scan Workspace] to begin.', vscode.TreeItemCollapsibleState.None, 'summary');
            emptyItem.iconPath = new vscode.ThemeIcon('shield');
            return Promise.resolve([emptyItem]);
        }
        // Root level: Summary + Severity Groups
        if (!element) {
            const items = [];
            // Summary Header Item
            const total = this.currentResult.total;
            const summaryText = `Total: ${total} issue${total === 1 ? '' : 's'}`;
            const summaryItem = new ThreatLensTreeItem(summaryText, vscode.TreeItemCollapsibleState.None, 'summary');
            summaryItem.description = `Critical: ${this.currentResult.summary['CRITICAL'] || 0} | High: ${this.currentResult.summary['HIGH'] || 0} | Med: ${this.currentResult.summary['MEDIUM'] || 0}`;
            summaryItem.iconPath = new vscode.ThemeIcon('dashboard');
            items.push(summaryItem);
            // Severity group nodes
            const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
            for (const sev of severities) {
                const count = this.currentResult.summary[sev] || 0;
                if (count > 0) {
                    const groupItem = new ThreatLensTreeItem(`${sev} (${count})`, vscode.TreeItemCollapsibleState.Expanded, 'group', undefined, sev);
                    groupItem.iconPath = this.getSeverityIcon(sev);
                    items.push(groupItem);
                }
            }
            return Promise.resolve(items);
        }
        // Children of Severity Group: Findings
        if (element.itemType === 'group' && element.groupSeverity) {
            const groupFindings = this.currentResult.findings.filter((f) => f.severity === element.groupSeverity);
            const items = groupFindings.map((f) => {
                const lineInfo = f.line ? `:${f.line}` : '';
                const item = new ThreatLensTreeItem(`${f.rule} [${path.basename(f.file)}${lineInfo}]`, vscode.TreeItemCollapsibleState.None, 'finding', f);
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
    getSeverityIcon(severity) {
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
exports.ThreatLensTreeDataProvider = ThreatLensTreeDataProvider;
//# sourceMappingURL=treeView.js.map