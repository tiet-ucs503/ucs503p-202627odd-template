# ThreatLens – Week 5 Progress

**Focus:** Stage 4 (Phases 13–15) – scanning GitHub repositories, plus readable and machine-readable reports.
**Branch:** `stage4-github-integration` (commit `adc6f97`)

## Work Completed

All new code is in the `github_integration/` package, one file per step.

### Phase 13 – Connect to GitHub
Created:

```text
github_integration/client.py
```

- Logs in with a fine-grained, **read-only** GitHub token, read from a `.env` file (git-ignored) or the `GITHUB_TOKEN` environment variable.
- `verify_connection()` makes one API call (`GET /user`), so a wrong or expired token fails immediately with a clear message.
- All login logic lives in this one file, so changing the login method later only changes this file.

```bash
python -m github_integration.client
[OK] Connected to GitHub as yazzzti23
     API calls left this hour: 4999/5000
```

### Phase 14 – Select Repository and Branch
Created:

```text
github_integration/repos.py           -> list repositories the token can see
github_integration/repo_selector.py   -> select ONE repository and check it
github_integration/branches.py        -> list branches + branch menu
```

- `RepoInfo` keeps only the fields ThreatLens needs (name, visibility, default branch, size, language, clone URL), so the rest of the code does not depend on PyGithub.
- `parse_full_name()` accepts `owner/repo`, `https://github.com/owner/repo(.git)`, `.../tree/main/...` and `git@github.com:owner/repo.git`.
- `select_repo()` rejects repositories that are not found or not accessible, are empty, or are larger than 500 MB.
- Listing branches and asking the user are separate functions. Code with nobody at the keyboard (the VS Code extension, CI) must never wait on `input()`.

### Phase 15 – Clone, Scan and Clean Up
Created:

```text
github_integration/cloner.py         -> shallow clone into a temporary folder
github_integration/repo_scanner.py   -> remove junk folders, scan, fix paths
github_integration/cleanup.py        -> always delete the clone
github_integration/pipeline.py       -> the whole flow in one function
```

The flow:

```text
select repo + branch
  |
git clone --depth 1 --single-branch   (token sent as an HTTP header)
  |
remove node_modules / site-packages / caches / virtualenvs
  |
SecurityEngine (Gitleaks + OSV-Scanner + Semgrep)
  |
convert paths to repo-relative ("app/config.py")
  |
delete the clone (always)
```

- **Token safety:** the token is passed to git through environment variables as an `Authorization` header, never in the URL, so it is not saved in `.git/config` or shown in the process list, and it is removed from any error message.
- **Exact version:** the commit SHA that was scanned is recorded.
- **Always delete:** `temporary_clone()` is a `with` block. The clone is deleted on success, on an error, and on Ctrl+C. A safety guard refuses to delete anything outside the clone folder, and old leftover clones (>24 h) are removed automatically.
- **Hand-off to Stage 5:** `scan_github_repo("owner/repo", branch)` runs everything, never prompts or prints, and returns the report, branch and commit.

### CLI and Reports
Updated `threatlens.py` and created `reporting/html_report.py` and `reporting/json_report.py`:

```bash
python threatlens.py --github owner/repo                  # branch menu
python threatlens.py --github owner/repo --branch dev     # no menu
python threatlens.py branches owner/repo                  # list branches
python threatlens.py ./folder --json                      # JSON for the extension
```

- **HTML report:** a plain, readable page (summary, findings table, details) that can be saved as a PDF from the browser. All values are HTML-escaped to prevent XSS from content in the scanned repository.
- **JSON output:** one JSON object on stdout (relative paths, 1-based lines, `null` when unknown, versioned with `schema_version`). Progress messages go to stderr.
- **Exit codes:** `0` = no HIGH/CRITICAL, `1` = HIGH/CRITICAL found, `2` = could not run.

## Difficulties Faced

- `ImportError: cannot import name 'Github' from 'github'`.
- Windows could not delete the cloned repositories.
- Scanning the team repository from GitHub failed with `OSV-Scanner exited with unexpected code 128`.
- Gitleaks and OSV reported absolute paths (`C:/Users/...`), while Semgrep reported relative ones.
- Raw text output cannot be used by the VS Code extension.

## How It Was Fixed

- The project's empty `github/` folder had the same name as the PyGithub package, so Python imported our folder instead of the library. Renamed it to `github_integration/`.
- Git marks files inside `.git/objects` as read-only and Windows refuses to delete them. `remove_tree()` now clears the read-only flag and retries.
- Two problems in `scanners/osv_scanner.py`: OSV does not search sub-folders by default (our `requirements.txt` is inside `project a/`), and exit code 128 means "no dependency files found", not a crash. Added `--recursive` and treated 128 as zero findings. This bug only appeared on a real repository, not on the local test repo.
- All paths are converted to repo-relative form once, right after the scan.
- Added `--json` and the `branches` command so the extension can read results with `JSON.parse`.

## Outcome

Stage 4 is complete and pushed (15 files, ~1,500 lines). Scanning the team repository from GitHub found **7 MEDIUM issues**:

```text
3 x GitHub Actions in .github/workflows/mkdocs.yml pinned to mutable tags (supply-chain risk)
4 x known CVEs in our own requirements.txt (flask 3.0.3, pytest 8.3.2, requests 2.32.3 x2)
```

Verified: the clone is deleted after success, an error and Ctrl+C; exit code is `1` for the test repo and `0` for the team repo; JSON output parses cleanly.

**Open issues:** duplicate findings from several Semgrep rules on one line, Semgrep "risk" text showing `(A)` when OWASP data is a string, OSV findings have no line number, PRs from forks are not handled yet, and tests for `github_integration/` are still to be written.