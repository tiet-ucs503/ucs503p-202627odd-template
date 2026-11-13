"""
Smoke and regression tests for BharatAssist Flask application.
Supports both unittest and pytest test runners.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app  # noqa: E402


class BharatAssistAppTests(unittest.TestCase):

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_home_page_loads(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)

    def test_services_page_loads(self):
        response = self.client.get("/services")
        self.assertEqual(response.status_code, 200)

    def test_assistant_page_loads(self):
        response = self.client.get("/assistant")
        self.assertEqual(response.status_code, 200)

    def test_simplify_page_loads(self):
        response = self.client.get("/simplify")
        self.assertEqual(response.status_code, 200)

    def test_assistant_requires_question(self):
        response = self.client.post("/api/assistant", json={})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)

    def test_assistant_empty_string_question(self):
        response = self.client.post("/api/assistant", json={"question": "   "})
        self.assertEqual(response.status_code, 400)

    def test_assistant_clear_endpoint(self):
        response = self.client.post("/api/assistant/clear")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("success"))

    def test_speech_to_text_requires_audio(self):
        response = self.client.post("/api/speech-to-text")
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get("success"))

    def test_text_to_speech_requires_text(self):
        response = self.client.post("/api/text-to-speech", json={})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get("success"))

    def test_services_api(self):
        response = self.client.get("/api/services")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("results", data)
        self.assertGreater(data.get("count", 0), 0)

    def test_services_search_api(self):
        response = self.client.get("/api/services/search?q=pan")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("results", data)

    def test_assistant_answering(self):
        response = self.client.post(
            "/api/assistant",
            json={"question": "What documents are required for a PAN card?"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("success"))
        self.assertTrue(len(data.get("answer", "")) > 0)


# Keep pytest-compatible standalone functions as well
def test_home_page_loads():
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200


def test_services_page_loads():
    client = app.test_client()
    response = client.get("/services")
    assert response.status_code == 200


def test_assistant_requires_question():
    client = app.test_client()
    response = client.post("/api/assistant", json={})
    assert response.status_code == 400


if __name__ == "__main__":
    unittest.main()
