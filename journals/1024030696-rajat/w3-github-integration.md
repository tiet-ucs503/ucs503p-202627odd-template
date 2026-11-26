# Week 3: GitHub API Integration, Remote Cloning & Security Pipeline

**Author**: Rajat (1024030696)  
**Collaborators**: Vidhi (1024030700), Yashti (1024030701)  
**Date**: September 2026

---

## 1. Objectives & Overview

In Week 3, we implemented **Stage 4: GitHub Integration**. The goal was allowing ThreatLens to scan any remote GitHub repository directly from the CLI or via automated pipelines, rather than being restricted to local folders.

The core technical challenge was building a **secure, ephemeral cloning pipeline**:
1. How to authenticate with GitHub without baking user tokens into command lines, log files, or URLs.
2. How to handle shallow clones efficiently without overloading disk space.
3. Guaranteeing that temporary repositories are purged immediately after scanning, even if an unhandled exception or scanner timeout occurs.

---

## 2. Key Contributions

### A. Secure Shallow Cloner (`github_integration/cloner.py`)
- **Token Security**: Traditional `git clone https://<token>@github.com/...` exposes tokens in process tables (`ps aux`) and `.git/config`. I collaborated on routing the token through an ephemeral Git HTTP header:
  ```python
  git_cmd = [
      "git", "-c", f"http.extraHeader=Authorization: Bearer {token}",
      "clone", "--depth", "1", "--single-branch", "--branch", branch, clone_url, dest_dir
  ]
  ```
  This guarantees that credentials never persist in URLs or on-disk git configuration.
- **Performance Optimization**: Enforced shallow clones (`--depth 1`) and `--single-branch`, decreasing clone transfer times by ~85% on large repositories.

### B. Fail-Safe Ephemeral Cleanup (`github_integration/cleanup.py`)
- Built the `temporary_clone` context manager:
  ```python
  @contextmanager
  def temporary_clone(info: RepoInfo, token: str, ref: str | None = None):
      cloned = clone_repo(info, token=token, ref=ref)
      try:
          yield cloned
      finally:
          safe_remove_directory(cloned.path)
  ```
- **Handling OS Permission Locks**: On Windows, `.git/objects` files frequently have read-only attributes that cause `shutil.rmtree` to fail. I implemented an `onerror` handler with `os.chmod(stat.S_IWRITE)` to reliably delete stubborn read-only objects.
- Added a stale directory cleanup sweeper that purges any temporary directories older than 24 hours.

### C. JSON Output Contract (`reporting/json_report.py`)
- Standardized the machine-readable JSON schema with top-level metadata:
  `schema_version`, `status`, `repository`, `branch`, `commit`, `summary`, `scanners`, `findings`.
- Added relative path normalization (`app/config.py` rather than absolute disk paths) so client tools like the VS Code extension can resolve paths directly against their active workspace root.

---

## 3. Team Collaboration

- **Collaborating with Vidhi**: Vidhi implemented the PyGithub client connection (`client.py`) and branch menu (`branches.py`). I helped her test the client against rate limits and verify personal access tokens (PAT) with restricted scopes.
- **Collaborating with Yashti**: Yashti built the repository selector (`repo_selector.py`). I assisted her in writing input validators to parse shorthand (`owner/repo`), HTTPS URLs, and `.git` suffixes, as well as enforcing pre-clone guards against empty repositories or repositories exceeding the 500 MB limit.

---

## 4. Key Learnings & Outcome

- **Defensive Resource Management**: Using Python's context managers (`with` blocks) ensures that system resources and disk storage are cleaned up deterministically, preventing disk exhaustion in CI/CD environments.
- **Contract-Driven API Design**: Solidifying the JSON schema early allowed us to work on the VS Code extension and CI automation simultaneously without breaking dependencies.
