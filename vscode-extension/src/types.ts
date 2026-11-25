/**
 * ThreatLens JSON contract types (Schema Version 1)
 * Matching project a/reporting/json_report.py
 */

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface Finding {
  file: string;            // relative path with forward slashes (e.g. "app/config.py")
  line: number | null;     // 1-based line, null if whole file/dependency
  column: number | null;   // 1-based column
  end_line: number | null;
  end_column: number | null;
  severity: SeverityLevel;
  category: string;        // "Secret", "Dependency Vulnerability", "Code Security", etc.
  tool: string;            // "Gitleaks" | "OSV-Scanner" | "Semgrep"
  rule: string;
  message: string;         // Plain-language explanation of what is wrong
  risk: string;            // Why it matters
  fix: string;             // Actionable recommendation on how to fix
  reference: string;       // Documentation or CVE URL
  fingerprint: string;     // Unique identifier
}

export interface ScannerStatus {
  name: string;
  ok: boolean;
  error: string | null;
}

export interface ScanResultSuccess {
  schema_version: number;
  status: 'ok';
  scanned_path: string;
  repository?: string;     // only for --github scans
  branch?: string;         // only for --github scans
  commit?: string;         // only for --github scans
  summary: Record<SeverityLevel | string, number>;
  total: number;
  scanners: ScannerStatus[];
  findings: Finding[];
}

export interface ScanResultError {
  schema_version: number;
  status: 'error';
  error_type: string;
  message: string;
}

export type ScanResult = ScanResultSuccess | ScanResultError;

export interface BranchListResult {
  schema_version: number;
  status: 'ok' | 'error';
  repository?: string;
  default_branch?: string;
  branches?: string[];
  message?: string;
}
