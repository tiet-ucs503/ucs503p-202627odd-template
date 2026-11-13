"""
Tests for strict database grounding and anti-hallucination policy.
Verifies that questions not related to or not present in the database return
'I am sorry, this information is not available in our database. May I help you with anything else?'
instead of answering from Gemini's general knowledge.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
import utils.llm as llm


class DatabaseGroundingTests(unittest.TestCase):

    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_out_of_database_general_question_returns_sorry(self):
        """Out-of-scope question (cooking recipe) must return polite decline, not Gemini general knowledge."""
        res = self.client.post("/api/assistant", json={
            "question": "How do I bake a chocolate cake at home?",
            "language": "English"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertFalse(data.get("grounded"))
        self.assertEqual(data.get("sources"), [])
        self.assertEqual(
            data.get("answer"),
            "I am sorry, this information is not available in our database. May I help you with anything else?"
        )

    def test_out_of_database_unsupported_service_returns_sorry(self):
        """Unsupported license/scheme (e.g. gun/arms license) must decline, not hallucinate."""
        res = self.client.post("/api/assistant", json={
            "question": "Tell me how to build a rocket engine at home.",
            "language": "English"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertFalse(data.get("grounded"))
        self.assertEqual(
            data.get("answer"),
            "I am sorry, this information is not available in our database. May I help you with anything else?"
        )

    def test_out_of_database_hindi_returns_sorry_in_hindi(self):
        """Out-of-database question in Hindi returns the exact Hindi decline message."""
        res = self.client.post("/api/assistant", json={
            "question": "पिज़्ज़ा कैसे बनाते हैं?",
            "language": "Hindi"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertFalse(data.get("grounded"))
        self.assertEqual(
            data.get("answer"),
            "क्षमा करें, यह जानकारी हमारे डेटाबेस में उपलब्ध नहीं है। क्या मैं आपकी किसी अन्य सरकारी सेवा में सहायता कर सकता हूँ?"
        )

    def test_conversational_greeting_does_not_say_sorry(self):
        """Greetings should respond warmly, not with 'sorry not available'."""
        for greeting in ["hello", "namaste", "hi", "good morning"]:
            res = self.client.post("/api/assistant", json={
                "question": greeting,
                "language": "English"
            })
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertNotIn("not available in our database", data.get("answer", ""))
            self.assertIn("BharatAssist", data.get("answer", ""))

    def test_in_database_query_answers_with_sources(self):
        """In-database question (PAN Card) must be grounded and provide sources."""
        res = self.client.post("/api/assistant", json={
            "question": "What documents are required for a PAN card?",
            "language": "English"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertTrue(data.get("grounded"))
        self.assertGreater(len(data.get("sources", [])), 0)
        self.assertTrue(len(data.get("answer", "")) > 0)
        self.assertNotIn("not available in our database", data.get("answer", ""))


if __name__ == "__main__":
    unittest.main()
