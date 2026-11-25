# tests/test_github_integration.py
# Unit tests for repo URL normalization, validation, and error contracts.

import unittest
from github_integration.repo_selector import parse_full_name, RepoSelectionError
from reporting import json_report


class TestRepoSelector(unittest.TestCase):

    def test_parse_valid_names(self):
        self.assertEqual(parse_full_name("owner/repo"), "owner/repo")
        self.assertEqual(parse_full_name("https://github.com/owner/repo"), "owner/repo")
        self.assertEqual(parse_full_name("https://github.com/owner/repo.git"), "owner/repo")
        self.assertEqual(parse_full_name("https://github.com/owner/repo/tree/main/src"), "owner/repo")
        self.assertEqual(parse_full_name("git@github.com:owner/repo.git"), "owner/repo")

    def test_reject_invalid_names(self):
        with self.assertRaises(RepoSelectionError):
            parse_full_name("just-a-name")

        with self.assertRaises(RepoSelectionError):
            parse_full_name("https://gitlab.com/owner/repo")


class TestJsonReporting(unittest.TestCase):

    def test_error_json_structure(self):
        err = json_report.error_json("Invalid repository token", "GitHubAuthError")
        self.assertEqual(err["schema_version"], 1)
        self.assertEqual(err["status"], "error")
        self.assertEqual(err["error_type"], "GitHubAuthError")
        self.assertEqual(err["message"], "Invalid repository token")


if __name__ == "__main__":
    unittest.main()
