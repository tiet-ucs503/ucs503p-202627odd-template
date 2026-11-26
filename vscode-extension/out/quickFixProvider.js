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
exports.ThreatLensQuickFixProvider = void 0;
const vscode = __importStar(require("vscode"));
class ThreatLensQuickFixProvider {
    static providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];
    findingsByFile = new Map();
    updateFindings(findings, workspaceRoot) {
        this.findingsByFile.clear();
        for (const f of findings) {
            const normalizedPath = f.file.replace(/\\/g, '/');
            const list = this.findingsByFile.get(normalizedPath) || [];
            list.push(f);
            this.findingsByFile.set(normalizedPath, list);
        }
    }
    provideCodeActions(document, range, context, token) {
        const actions = [];
        // Filter diagnostics matching ThreatLens
        const threatlensDiagnostics = context.diagnostics.filter((d) => typeof d.source === 'string' && d.source.startsWith('ThreatLens'));
        if (threatlensDiagnostics.length === 0) {
            return actions;
        }
        for (const diag of threatlensDiagnostics) {
            // 1. Action: Show Remediation Details
            const explainAction = new vscode.CodeAction(`ThreatLens: View Risk & Remediation Details (${diag.code})`, vscode.CodeActionKind.QuickFix);
            explainAction.diagnostics = [diag];
            explainAction.isPreferred = true;
            explainAction.command = {
                command: 'threatlens.showFindingDetails',
                title: 'Show Finding Details',
                arguments: [diag],
            };
            actions.push(explainAction);
            // 2. Action: Copy Recommendation
            const copyAction = new vscode.CodeAction(`ThreatLens: Copy Fix Recommendation`, vscode.CodeActionKind.QuickFix);
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
exports.ThreatLensQuickFixProvider = ThreatLensQuickFixProvider;
//# sourceMappingURL=quickFixProvider.js.map