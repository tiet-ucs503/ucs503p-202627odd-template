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
exports.DiagnosticsManager = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class DiagnosticsManager {
    diagnosticCollection;
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('threatlens');
    }
    get collection() {
        return this.diagnosticCollection;
    }
    /**
     * Clear all current diagnostics.
     */
    clear() {
        this.diagnosticCollection.clear();
    }
    /**
     * Update the Problems panel with findings from a scan result.
     */
    updateDiagnostics(result, workspaceRoot) {
        this.clear();
        const rootPath = workspaceRoot || result.scanned_path;
        const fileFindingsMap = new Map();
        for (const finding of result.findings) {
            const list = fileFindingsMap.get(finding.file) || [];
            list.push(finding);
            fileFindingsMap.set(finding.file, list);
        }
        fileFindingsMap.forEach((findings, relFilePath) => {
            const absPath = path.isAbsolute(relFilePath)
                ? relFilePath
                : path.join(rootPath, relFilePath);
            const uri = vscode.Uri.file(absPath);
            const diagnostics = findings.map((f) => this.toDiagnostic(f));
            this.diagnosticCollection.set(uri, diagnostics);
        });
    }
    /**
     * Convert a ThreatLens Finding into a VS Code Diagnostic.
     */
    toDiagnostic(finding) {
        // 1-based to 0-based conversion. Package/repo-level findings (null line) anchor at line 0.
        const startLine = finding.line && finding.line > 0 ? finding.line - 1 : 0;
        const startChar = finding.column && finding.column > 0 ? finding.column - 1 : 0;
        const endLine = finding.end_line && finding.end_line > 0 ? finding.end_line - 1 : startLine;
        const endChar = finding.end_column && finding.end_column > 0
            ? finding.end_column - 1
            : (finding.column ? startChar + 10 : 80);
        const range = new vscode.Range(new vscode.Position(startLine, startChar), new vscode.Position(endLine, endChar));
        const severity = this.mapSeverity(finding.severity);
        const messageLines = [
            finding.message,
            `Risk: ${finding.risk}`,
            `Fix: ${finding.fix}`,
        ];
        const message = messageLines.join('\n\n');
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = `ThreatLens (${finding.tool})`;
        diagnostic.code = finding.rule;
        if (finding.reference && finding.reference.startsWith('http')) {
            try {
                diagnostic.code = {
                    value: finding.rule,
                    target: vscode.Uri.parse(finding.reference),
                };
            }
            catch {
                // Fallback to simple string if URL parsing fails
                diagnostic.code = finding.rule;
            }
        }
        return diagnostic;
    }
    /**
     * Map ThreatLens severity to VS Code DiagnosticSeverity.
     */
    mapSeverity(level) {
        switch (level) {
            case 'CRITICAL':
            case 'HIGH':
                return vscode.DiagnosticSeverity.Error;
            case 'MEDIUM':
                return vscode.DiagnosticSeverity.Warning;
            case 'LOW':
                return vscode.DiagnosticSeverity.Information;
            case 'INFO':
            default:
                return vscode.DiagnosticSeverity.Hint;
        }
    }
    dispose() {
        this.diagnosticCollection.dispose();
    }
}
exports.DiagnosticsManager = DiagnosticsManager;
//# sourceMappingURL=diagnostics.js.map