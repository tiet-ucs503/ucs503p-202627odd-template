# reporting/html_report.py
#
# Readable HTML version of the ThreatLens report.
#
# Why HTML (and not PDF directly)?
#   - Needs NO extra libraries - just Python's standard library.
#   - Opens in any browser, on any OS.
#   - Ctrl+P -> "Save as PDF" in the browser gives a clean PDF
#     (the CSS below has print rules for that).
#
# SECURITY NOTE: everything in a finding (file names, Semgrep messages,
# package summaries) comes from the SCANNED repo - i.e. from a stranger.
# A file named  <script>alert(1)</script>.py  would run JavaScript in the
# reader's browser if we pasted it in raw. So EVERY value goes through
# html.escape() before it is put into the page.

import datetime
import html
import webbrowser
from pathlib import Path

from engine.finding import Finding, Severity
from engine.security_engine import ScanReport

SEVERITY_ORDER = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]

# One muted colour per severity - used only for the small label.
SEVERITY_COLOUR = {
    Severity.CRITICAL: "#8b0000",
    Severity.HIGH:     "#c0392b",
    Severity.MEDIUM:   "#b9770e",
    Severity.LOW:      "#2e6da4",
    Severity.INFO:     "#666666",
}

CSS = """
body   { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
         color: #222; max-width: 900px; margin: 32px auto; padding: 0 16px;
         line-height: 1.5; font-size: 15px; }
h1     { font-size: 24px; margin-bottom: 4px; }
h2     { font-size: 18px; margin-top: 32px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
h3     { font-size: 16px; margin: 0 0 8px; }
table  { border-collapse: collapse; width: 100%; margin: 8px 0; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
th     { background: #f6f6f6; font-weight: 600; }
.meta td:first-child { color: #666; width: 140px; }
.sev   { display: inline-block; padding: 1px 8px; border-radius: 3px; color: #fff;
         font-size: 12px; font-weight: 600; }
.finding { border: 1px solid #ddd; border-radius: 4px; padding: 14px 16px; margin: 14px 0; }
.label { font-weight: 600; margin-top: 10px; }
.text  { white-space: pre-wrap; margin: 2px 0 0; }
code, .mono { font-family: Consolas, "Courier New", monospace; font-size: 13px; }
.muted { color: #666; }
.warn  { background: #fff6e5; border: 1px solid #f0c36d; padding: 8px 12px; border-radius: 4px; }
a      { color: #2e6da4; }
@media print {
  body     { margin: 0; max-width: none; font-size: 12px; }
  .finding { page-break-inside: avoid; }
  a        { color: #222; text-decoration: none; }
}
"""


def _e(value) -> str:
    """Escape any value for safe use inside HTML."""
    return html.escape(str(value))


def _display_path(path: str, repo_path: str) -> str:
    """'C:/Users/.../repo/app/config.py' -> 'app/config.py'."""
    p = path.replace("\\", "/")
    root = repo_path.replace("\\", "/").rstrip("/") + "/"
    if p.lower().startswith(root.lower()):
        p = p[len(root):]
    return p or "-"


def _location(f: Finding, repo_path: str) -> str:
    where = _display_path(f.file, repo_path)
    return f"{where}:{f.start_line}" if f.start_line else where


def _sev_label(sev: Severity) -> str:
    return f'<span class="sev" style="background:{SEVERITY_COLOUR[sev]}">{_e(sev)}</span>'


def build_html(report: ScanReport, details: dict | None = None) -> str:
    """Return the full report as one HTML string.

    Args:
        report:  output of SecurityEngine.scan()
        details: optional extra rows for the header, e.g.
                 {"Repository": "owner/repo", "Branch": "main", "Commit": "4f1b76a"}
    """
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    rows = dict(details or {})
    if "Repository" not in rows:
        # Local scan: show the folder. (For GitHub scans the folder was a
        # temporary clone that is already deleted, so we leave it out.)
        rows["Scanned folder"] = report.repo_path
    rows["Scan time"] = now
    rows["Scanners"] = ", ".join(
        f"{r.scanner_name} ({'ok' if r.success else 'FAILED'})" for r in report.scanner_results
    )

    parts: list[str] = []
    parts.append(f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
                 f"<title>ThreatLens report</title><style>{CSS}</style></head><body>")

    # ── Header ─────────────────────────────────────────────
    parts.append("<h1>ThreatLens Security Report</h1>")
    parts.append("<table class='meta'>")
    for k, v in rows.items():
        parts.append(f"<tr><td>{_e(k)}</td><td>{_e(v)}</td></tr>")
    parts.append("</table>")

    # ── Summary ────────────────────────────────────────────
    parts.append("<h2>Summary</h2>")
    parts.append(f"<p><b>{report.total}</b> issue(s) found.</p>")
    parts.append("<table><tr><th>Severity</th><th>Count</th></tr>")
    for sev in SEVERITY_ORDER:
        parts.append(f"<tr><td>{_sev_label(sev)}</td><td>{report.summary.get(str(sev), 0)}</td></tr>")
    parts.append("</table>")

    if report.failed_scanners:
        parts.append("<div class='warn'><b>Some scanners failed</b> - results below are incomplete.<ul>")
        for r in report.failed_scanners:
            parts.append(f"<li><b>{_e(r.scanner_name)}</b>: {_e(r.error[:300])}</li>")
        parts.append("</ul></div>")

    if report.total == 0:
        parts.append("<p>No security issues found.</p></body></html>")
        return "".join(parts)

    # ── Overview table (one line per finding) ──────────────
    parts.append("<h2>All findings</h2>")
    parts.append("<table><tr><th>#</th><th>Severity</th><th>Type</th><th>Location</th><th>Tool</th></tr>")
    for i, f in enumerate(report.findings, 1):
        parts.append(
            f"<tr><td><a href='#f{i}'>{i}</a></td><td>{_sev_label(f.severity)}</td>"
            f"<td>{_e(f.category)}</td><td class='mono'>{_e(_location(f, report.repo_path))}</td>"
            f"<td>{_e(f.tool)}</td></tr>"
        )
    parts.append("</table>")

    # ── Details ────────────────────────────────────────────
    parts.append("<h2>Details</h2>")
    for i, f in enumerate(report.findings, 1):
        parts.append(f"<div class='finding' id='f{i}'>")
        parts.append(f"<h3>{i}. {_sev_label(f.severity)} {_e(f.category)}</h3>")
        parts.append(
            f"<div class='muted'><span class='mono'>{_e(_location(f, report.repo_path))}</span>"
            f" &middot; {_e(f.tool)} &middot; rule <code>{_e(f.rule)}</code></div>"
        )
        parts.append(f"<div class='label'>What is wrong</div><div class='text'>{_e(f.description)}</div>")
        parts.append(f"<div class='label'>Why it matters</div><div class='text'>{_e(f.risk)}</div>")
        parts.append(f"<div class='label'>How to fix</div><div class='text'>{_e(f.recommendation)}</div>")
        if f.reference.startswith(("http://", "https://")):
            parts.append(f"<div class='label'>Reference</div>"
                         f"<a href='{_e(f.reference)}' rel='noopener noreferrer'>{_e(f.reference)}</a>")
        parts.append("</div>")

    parts.append("<p class='muted'>Generated by ThreatLens.</p></body></html>")
    return "".join(parts)


def write_html_report(report: ScanReport, output_dir: Path, name: str,
                      details: dict | None = None, open_in_browser: bool = True) -> Path:
    """Write the report to <output_dir>/threatlens-<name>-<timestamp>.html and return the path."""
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    path = output_dir / f"threatlens-{safe_name}-{stamp}.html"
    path.write_text(build_html(report, details), encoding="utf-8")
    if open_in_browser:
        webbrowser.open(path.resolve().as_uri())
    return path