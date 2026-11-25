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
exports.EngineRunner = void 0;
const cp = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class EngineRunner {
    outputChannel;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    /**
     * Determine the Python interpreter path to use.
     */
    getPythonPath(cliPath) {
        const config = vscode.workspace.getConfiguration('threatlens');
        let customPython = config.get('pythonPath', '').trim();
        if (customPython) {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                customPython = customPython.replace(/\$\{workspaceFolder\}/g, vscode.workspace.workspaceFolders[0].uri.fsPath);
            }
            if (fs.existsSync(customPython)) {
                return customPython;
            }
        }
        const pyBinName = process.platform === 'win32' ? path.join('Scripts', 'python.exe') : path.join('bin', 'python');
        // 1. Auto-detect .venv alongside threatlens.py
        if (cliPath) {
            const venvCandidates = [
                path.join(path.dirname(cliPath), '.venv', pyBinName),
                path.join(path.dirname(cliPath), 'venv', pyBinName),
                path.join(path.dirname(cliPath), '..', '.venv', pyBinName),
            ];
            for (const cand of venvCandidates) {
                if (fs.existsSync(cand)) {
                    return cand;
                }
            }
        }
        // 2. Check well-known workspace project virtualenv
        const knownVenv = '/Users/matrix/Desktop/Sem 5/software eng/Project final repo/UCS503P_202627_ThreatLens/project a/.venv/' + pyBinName;
        if (fs.existsSync(knownVenv)) {
            return knownVenv;
        }
        // 3. Auto-detect .venv by walking up from workspace folders or active editor
        const startDirs = [];
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                startDirs.push(folder.uri.fsPath);
            }
        }
        if (vscode.window.activeTextEditor) {
            startDirs.push(path.dirname(vscode.window.activeTextEditor.document.uri.fsPath));
        }
        for (const start of startDirs) {
            let curr = start;
            for (let i = 0; i < 6; i++) {
                const candidates = [
                    path.join(curr, 'project a', '.venv', pyBinName),
                    path.join(curr, 'UCS503P_202627_ThreatLens', 'project a', '.venv', pyBinName),
                    path.join(curr, '.venv', pyBinName),
                ];
                for (const cand of candidates) {
                    if (fs.existsSync(cand)) {
                        return cand;
                    }
                }
                const parent = path.dirname(curr);
                if (parent === curr)
                    break;
                curr = parent;
            }
        }
        return process.platform === 'win32' ? 'python' : 'python3';
    }
    /**
     * Locate threatlens.py CLI script using settings, VS Code file search, and fallback paths.
     */
    async findCliPath() {
        const config = vscode.workspace.getConfiguration('threatlens');
        let customCli = config.get('cliPath', '').trim();
        // 1. Check user/workspace configuration with ${workspaceFolder} resolution
        if (customCli) {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                customCli = customCli.replace(/\$\{workspaceFolder\}/g, vscode.workspace.workspaceFolders[0].uri.fsPath);
            }
            if (fs.existsSync(customCli)) {
                this.outputChannel.appendLine(`[ThreatLens] Using configured CLI path: ${customCli}`);
                return customCli;
            }
            this.outputChannel.appendLine(`[ThreatLens] Configured cliPath does not exist: ${customCli}`);
        }
        // 2. Use VS Code's workspace search index
        try {
            const foundUris = await vscode.workspace.findFiles('**/threatlens.py', '{**/node_modules/**,**/.git/**,**/tmp_repos/**}', 5);
            if (foundUris && foundUris.length > 0) {
                const found = foundUris[0].fsPath;
                this.outputChannel.appendLine(`[ThreatLens] Discovered threatlens.py via VS Code workspace search: ${found}`);
                return found;
            }
        }
        catch (e) {
            this.outputChannel.appendLine(`[ThreatLens] Workspace findFiles: ${e.message}`);
        }
        // 3. Search upward from workspace folders, active editor, and extension location
        const startDirs = [];
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                startDirs.push(folder.uri.fsPath);
            }
        }
        if (vscode.window.activeTextEditor) {
            startDirs.push(path.dirname(vscode.window.activeTextEditor.document.uri.fsPath));
        }
        startDirs.push(__dirname);
        startDirs.push(process.cwd());
        for (const start of startDirs) {
            let curr = start;
            for (let i = 0; i < 6; i++) {
                const candidates = [
                    path.join(curr, 'project a', 'threatlens.py'),
                    path.join(curr, 'UCS503P_202627_ThreatLens', 'project a', 'threatlens.py'),
                    path.join(curr, 'threatlens.py'),
                ];
                for (const cand of candidates) {
                    if (fs.existsSync(cand)) {
                        const resolved = path.resolve(cand);
                        this.outputChannel.appendLine(`[ThreatLens] Discovered threatlens.py via upward hierarchy search: ${resolved}`);
                        return resolved;
                    }
                }
                const parent = path.dirname(curr);
                if (parent === curr)
                    break;
                curr = parent;
            }
        }
        // 4. Downward directory search from workspace roots
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                const root = folder.uri.fsPath;
                const found = this.searchFile(root, 'threatlens.py', 4);
                if (found) {
                    this.outputChannel.appendLine(`[ThreatLens] Discovered threatlens.py via folder search: ${found}`);
                    return found;
                }
            }
        }
        // 5. Well-known fallback paths
        const hardcodedCandidates = [
            '/Users/matrix/Desktop/Sem 5/software eng/Project final repo/UCS503P_202627_ThreatLens/project a/threatlens.py',
        ];
        for (const h of hardcodedCandidates) {
            if (fs.existsSync(h)) {
                this.outputChannel.appendLine(`[ThreatLens] Found threatlens.py at well-known path: ${h}`);
                return h;
            }
        }
        this.outputChannel.appendLine('[ThreatLens] Could not locate threatlens.py in workspace.');
        return null;
    }
    searchFile(dir, targetName, maxDepth) {
        if (maxDepth <= 0 || !fs.existsSync(dir)) {
            return null;
        }
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules' ||
                    entry.name === '.git' ||
                    entry.name === '.venv' ||
                    entry.name === 'tmp_repos' ||
                    entry.name === '.vscode') {
                    continue;
                }
                const full = path.join(dir, entry.name);
                if (!entry.isDirectory() && entry.name === targetName) {
                    return full;
                }
                if (entry.isDirectory()) {
                    const res = this.searchFile(full, targetName, maxDepth - 1);
                    if (res) {
                        return res;
                    }
                }
            }
        }
        catch {
            // Ignore file system access errors
        }
        return null;
    }
    /**
     * Execute a local workspace scan.
     */
    async scanLocal(targetPath, token) {
        const cliPath = await this.findCliPath();
        if (!cliPath) {
            throw new Error('Could not find threatlens.py. Please verify project a/threatlens.py exists or set threatlens.cliPath in settings.');
        }
        const python = this.getPythonPath(cliPath);
        const args = [cliPath, targetPath, '--json', '--no-open'];
        return this.runCli(args, python, token, path.dirname(cliPath));
    }
    /**
     * Execute a remote GitHub scan.
     */
    async scanGitHub(repo, branch, token) {
        const cliPath = await this.findCliPath();
        if (!cliPath) {
            throw new Error('Could not find threatlens.py. Please verify project a/threatlens.py exists or set threatlens.cliPath in settings.');
        }
        const python = this.getPythonPath(cliPath);
        const args = [cliPath, '--github', repo, '--json', '--no-open'];
        if (branch) {
            args.push('--branch', branch);
        }
        return this.runCli(args, python, token, path.dirname(cliPath));
    }
    /**
     * Fetch branches of a remote GitHub repository.
     */
    async listBranches(repo, token) {
        const cliPath = await this.findCliPath();
        if (!cliPath) {
            throw new Error('Could not find threatlens.py. Please verify project a/threatlens.py exists or set threatlens.cliPath in settings.');
        }
        const python = this.getPythonPath(cliPath);
        const args = [cliPath, 'branches', repo, '--json'];
        const res = await this.runCli(args, python, token, path.dirname(cliPath));
        return res;
    }
    /**
     * Low-level process spawner and stream collector.
     */
    runCli(args, python, token, cwd) {
        return new Promise((resolve, reject) => {
            this.outputChannel.appendLine(`\n[ThreatLens] Python: ${python}`);
            this.outputChannel.appendLine(`[ThreatLens] Command: ${python} ${args.join(' ')}`);
            this.outputChannel.appendLine(`[ThreatLens] Working Directory: ${cwd || process.cwd()}`);
            const env = {
                ...process.env,
                PYTHONUNBUFFERED: '1',
            };
            if (token) {
                env.GITHUB_TOKEN = token;
            }
            const proc = cp.spawn(python, args, {
                cwd: cwd || process.cwd(),
                env,
            });
            let stdoutData = '';
            let stderrData = '';
            proc.stdout.on('data', (chunk) => {
                stdoutData += chunk.toString();
            });
            proc.stderr.on('data', (chunk) => {
                const text = chunk.toString();
                stderrData += text;
                this.outputChannel.append(text);
            });
            proc.on('error', (err) => {
                this.outputChannel.appendLine(`[ThreatLens Error] Failed to start process: ${err.message}`);
                reject(new Error(`Failed to launch Python (${python}): ${err.message}`));
            });
            proc.on('close', (code) => {
                this.outputChannel.appendLine(`[ThreatLens] Process completed with exit code: ${code}`);
                if (!stdoutData.trim()) {
                    reject(new Error(`ThreatLens CLI returned no output (exit code ${code}). Stderr: ${stderrData}`));
                    return;
                }
                try {
                    const parsed = JSON.parse(stdoutData.trim());
                    if (parsed.status === 'error') {
                        reject(new Error(parsed.message || 'Unknown ThreatLens scan error'));
                        return;
                    }
                    resolve(parsed);
                }
                catch (err) {
                    reject(new Error(`Failed to parse ThreatLens JSON output: ${err.message}\nRaw output: ${stdoutData}`));
                }
            });
        });
    }
}
exports.EngineRunner = EngineRunner;
//# sourceMappingURL=engineRunner.js.map