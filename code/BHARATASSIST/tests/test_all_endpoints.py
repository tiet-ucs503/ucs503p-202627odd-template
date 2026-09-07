"""
Comprehensive End-to-End Test Suite for BharatAssist.
Tests all 13+ endpoints across:
- HTML Page routes (Home, Services, Service Details, Schemes, Simplifier, Assistant)
- Services REST API (Listing, Details by ID, Search by Query, 404 validation)
- Civic AI Assistant (PII redaction, Grounded RAG, Multilingual Hindi/Punjabi/English, Context Clear)
- Document Simplifier (Text simplification, validation)
- Voice & Audio Paths (Speech-to-Text validation, Text-to-Speech synthesis)
"""

import os
import sys
import sqlite3
import unittest

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, get_all_services, DB_PATH  # noqa: E402


class AllEndpointsTestSuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.app = app
        cls.app.config["TESTING"] = True
        cls.client = cls.app.test_client()
        # Find valid existing service ID from database
        services = get_all_services()
        cls.valid_service_id = services[0]["id"] if services else 21

    # ==========================================================
    # 1. HTML PAGE ROUTES
    # ==========================================================

    def test_01_homepage_endpoint(self):
        """GET / -> Returns 200 HTML"""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/html", res.content_type)

    def test_02_services_page_endpoint(self):
        """GET /services -> Returns 200 HTML"""
        res = self.client.get("/services")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/html", res.content_type)

    def test_03_service_detail_page_valid_id(self):
        """GET /services/<valid_id> -> Returns 200 HTML"""
        res = self.client.get(f"/services/{self.valid_service_id}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/html", res.content_type)

    def test_04_service_detail_page_invalid_id(self):
        """GET /services/99999 -> Returns 404 HTML gracefully"""
        res = self.client.get("/services/99999")
        self.assertEqual(res.status_code, 404)

    def test_05_schemes_page_endpoint(self):
        """GET /schemes -> Returns 200 HTML"""
        res = self.client.get("/schemes")
        self.assertEqual(res.status_code, 200)

    def test_06_simplify_page_endpoint(self):
        """GET /simplify -> Returns 200 HTML"""
        res = self.client.get("/simplify")
        self.assertEqual(res.status_code, 200)

    def test_07_assistant_page_endpoint(self):
        """GET /assistant -> Returns 200 HTML"""
        res = self.client.get("/assistant")
        self.assertEqual(res.status_code, 200)

    # ==========================================================
    # 2. SERVICES REST API
    # ==========================================================

    def test_08_api_services_list(self):
        """GET /api/services -> Returns JSON list of services"""
        res = self.client.get("/api/services")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("results", data)
        self.assertGreater(data.get("count", 0), 0)

    def test_09_api_services_valid_id(self):
        """GET /api/services/<id> -> Returns JSON service object"""
        res = self.client.get(f"/api/services/{self.valid_service_id}")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("service", {}).get("id"), self.valid_service_id)

    def test_10_api_services_invalid_id(self):
        """GET /api/services/99999 -> Returns 404 JSON error"""
        res = self.client.get("/api/services/99999")
        self.assertEqual(res.status_code, 404)
        data = res.get_json()
        self.assertFalse(data.get("success"))

    def test_11_api_services_search(self):
        """GET /api/services/search?q=licence -> Returns filtered services"""
        res = self.client.get("/api/services/search?q=licence")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("results", data)
        self.assertGreater(len(data.get("results", [])), 0)

    # ==========================================================
    # 3. CIVIC AI ASSISTANT API
    # ==========================================================

    def test_12_api_assistant_empty_validation(self):
        """POST /api/assistant with empty payload -> Returns 400"""
        res = self.client.post("/api/assistant", json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("error", data)

    def test_13_api_assistant_clear_context(self):
        """POST /api/assistant/clear -> Returns 200 success"""
        res = self.client.post("/api/assistant/clear")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))

    def test_14_api_assistant_multilingual_hindi(self):
        """POST /api/assistant with Hindi language -> Returns 200 answer"""
        res = self.client.post("/api/assistant", json={
            "question": "What documents are required for a PAN card?",
            "language": "Hindi"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertTrue(len(data.get("answer", "")) > 0)

    # ==========================================================
    # 4. DOCUMENT SIMPLIFIER API
    # ==========================================================

    def test_15_api_simplify_empty_validation(self):
        """POST /api/simplify with empty text -> Returns 400"""
        res = self.client.post("/api/simplify", data={"text": ""})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))

    def test_16_api_simplify_valid_text(self):
        """POST /api/simplify with legal/civic text -> Returns 200 with summary"""
        res = self.client.post("/api/simplify", data={
            "text": "The citizen must submit Form 49A along with identity proof and fee of 107 rupees."
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("simplified_text", data)

    # ==========================================================
    # 5. VOICE & AUDIO PATHS (STT / TTS)
    # ==========================================================

    def test_17_api_speech_to_text_missing_file(self):
        """POST /api/speech-to-text without file -> Returns 400"""
        res = self.client.post("/api/speech-to-text")
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))

    def test_18_api_text_to_speech_missing_text(self):
        """POST /api/text-to-speech without text -> Returns 400"""
        res = self.client.post("/api/text-to-speech", json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))

    def test_19_api_text_to_speech_valid_synthesis(self):
        """POST /api/text-to-speech with text -> Returns 200 audio/wav"""
        res = self.client.post("/api/text-to-speech", json={
            "text": "Namaste! Welcome to BharatAssist.",
            "language": "English"
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn(res.content_type, ["audio/wav", "audio/mpeg"])
        self.assertGreater(len(res.data), 1000)


    # ==========================================================
    # 6. INDIAN CITIZEN MOBILE OTP & ZERO-LLM PHONE PRIVACY
    # ==========================================================

    def test_20_login_page_endpoint(self):
        """GET /login -> Returns 200 HTML with Indian Mobile OTP and Privacy Shield UI"""
        res = self.client.get("/login")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/html", res.content_type)
        html = res.get_data(as_text=True)
        self.assertIn("Citizen Sign In", html)
        self.assertIn("Indian Mobile Number", html)
        self.assertIn("Zero-LLM", html)

    def test_21_api_auth_send_otp_invalid_phone(self):
        """POST /api/auth/send-otp with invalid/short number -> Returns 400"""
        res = self.client.post("/api/auth/send-otp", json={"phone": "12345"})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("valid 10-digit", data.get("error", ""))

    def test_22_api_auth_send_otp_valid_phone(self):
        """POST /api/auth/send-otp with valid 10-digit Indian phone -> Returns 200 with OTP"""
        res = self.client.post("/api/auth/send-otp", json={
            "phone": "9876543210",
            "name": "Rohan Gupta"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["phone"], "9876543210")
        self.assertIn("otp_hint", data)
        self.assertEqual(len(data["otp_hint"]), 6)

    def test_23_api_auth_verify_otp_valid(self):
        """POST /api/auth/verify-otp with matching OTP -> Logs in citizen, sets session"""
        # 1. Send OTP first
        send_res = self.client.post("/api/auth/send-otp", json={
            "phone": "9812345678",
            "name": "Pooja Verma"
        })
        otp = send_res.get_json()["otp_hint"]

        # 2. Verify with correct OTP
        verify_res = self.client.post("/api/auth/verify-otp", json={
            "phone": "9812345678",
            "otp": otp
        })
        self.assertEqual(verify_res.status_code, 200)
        data = verify_res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["user"]["phone"], "9812345678")
        self.assertEqual(data["user"]["name"], "Pooja Verma")

        # 3. Verify session is set
        with self.client.session_transaction() as sess:
            self.assertIn("user", sess)
            self.assertEqual(sess["user"]["phone"], "9812345678")

    def test_24_api_auth_verify_otp_invalid(self):
        """POST /api/auth/verify-otp with incorrect OTP -> Returns 400"""
        self.client.post("/api/auth/send-otp", json={"phone": "9712345678"})
        res = self.client.post("/api/auth/verify-otp", json={
            "phone": "9712345678",
            "otp": "000000"
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("Incorrect OTP", data.get("error", ""))

    def test_25_logout_endpoint(self):
        """GET /logout -> Clears session and redirects to /login"""
        # 1. Sign in via OTP
        send_res = self.client.post("/api/auth/send-otp", json={"phone": "9612345678"})
        otp = send_res.get_json()["otp_hint"]
        self.client.post("/api/auth/verify-otp", json={"phone": "9612345678", "otp": otp})

        # 2. Logout
        res = self.client.get("/logout")
        self.assertEqual(res.status_code, 302)
        self.assertIn("/login", res.headers.get("Location", ""))

        # 3. Verify session cleared
        with self.client.session_transaction() as sess:
            self.assertNotIn("user", sess)

    def test_26_zero_llm_privacy_phone_isolation(self):
        """Zero-LLM Phone Invariant: Citizen's mobile number is strictly scrubbed before Gemini"""
        from utils.redact import redact_pii

        mock_user = {
            "phone": "9876543210",
            "name": "Arjun Singhania"
        }

        # Prompt with various formats of the citizen's phone number
        raw_prompt = (
            "Hello, my name is Arjun Singhania. "
            "Please call me at 9876543210 or +91 9876543210 or 98765 43210. "
            "How do I apply for a PAN card?"
        )
        cleaned_prompt, count = redact_pii(raw_prompt, user=mock_user)

        # Invariants:
        # 1. Citizen's phone number MUST NOT appear in the prompt sent to LLM in ANY format
        self.assertNotIn("9876543210", cleaned_prompt)
        self.assertNotIn("+91 9876543210", cleaned_prompt)
        self.assertNotIn("98765 43210", cleaned_prompt)
        # 2. Replaced with redaction placeholder
        self.assertIn("[REDACTED_CITIZEN_PHONE]", cleaned_prompt)
        # 3. Citizen's name also scrubbed
        self.assertNotIn("Arjun Singhania", cleaned_prompt)
        self.assertIn("[REDACTED_CITIZEN_NAME]", cleaned_prompt)
        # 4. Total count of redactions must be at least 4
        self.assertGreaterEqual(count, 4)

    # ==========================================================
    # 7. MANDATORY CITIZEN NAME, PASSWORD AUTH & CHAT HISTORY
    # ==========================================================

    def test_27_register_missing_mandatory_name(self):
        """POST /api/auth/register-send-otp without name -> Returns 400 (Name is mandatory)"""
        res = self.client.post("/api/auth/register-send-otp", json={
            "name": "",
            "phone": "9811122233",
            "password": "Password123"
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("mandatory", data["error"].lower())

    def test_28_register_and_verify_with_password(self):
        """New Citizen Registration Flow: Name + Phone + Password + OTP verification"""
        test_phone = "9822233344"
        test_name = "Vikramaditya Rao"
        test_pwd = "StrongCivicPass2026!"

        # Ensure test user does not pre-exist
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM users WHERE phone = ?", (test_phone,))
            conn.execute("DELETE FROM chat_history WHERE user_phone = ?", (test_phone,))
            conn.commit()

        # Step 1: Send OTP
        send_res = self.client.post("/api/auth/register-send-otp", json={
            "name": test_name,
            "phone": test_phone,
            "password": test_pwd
        })
        self.assertEqual(send_res.status_code, 200)
        send_data = send_res.get_json()
        self.assertTrue(send_data["success"])
        otp = send_data["otp_hint"]

        # Step 2: Verify OTP
        verify_res = self.client.post("/api/auth/register-verify", json={
            "phone": test_phone,
            "otp": otp
        })
        self.assertEqual(verify_res.status_code, 200)
        verify_data = verify_res.get_json()
        self.assertTrue(verify_data["success"])
        self.assertEqual(verify_data["user"]["name"], test_name)
        self.assertEqual(verify_data["user"]["phone"], test_phone)

        # Check session
        with self.client.session_transaction() as sess:
            self.assertEqual(sess["user"]["name"], test_name)
            self.assertEqual(sess["user"]["phone"], test_phone)

    def test_29_register_duplicate_phone_rejected(self):
        """POST /api/auth/register-send-otp for already verified account -> Returns 400"""
        # Phone 9822233344 was verified in test_28
        res = self.client.post("/api/auth/register-send-otp", json={
            "name": "Imposter User",
            "phone": "9822233344",
            "password": "NewPassword123"
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("already registered", data["error"].lower())

    def test_30_login_password_success(self):
        """POST /api/auth/login-password with correct mobile & password -> Returns 200"""
        # Logout first
        self.client.get("/logout")

        res = self.client.post("/api/auth/login-password", json={
            "phone": "9822233344",
            "password": "StrongCivicPass2026!"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["name"], "Vikramaditya Rao")

        # Session is now established
        with self.client.session_transaction() as sess:
            self.assertEqual(sess["user"]["name"], "Vikramaditya Rao")

    def test_31_login_password_invalid(self):
        """POST /api/auth/login-password with incorrect password -> Returns 401"""
        res = self.client.post("/api/auth/login-password", json={
            "phone": "9822233344",
            "password": "WrongPassword999"
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("incorrect password", data["error"].lower())

    def test_32_persistent_chat_history_flow(self):
        """Chat history is saved for authenticated citizens and retrieved via GET /api/assistant/history"""
        # Login first
        self.client.post("/api/auth/login-password", json={
            "phone": "9822233344",
            "password": "StrongCivicPass2026!"
        })

        # Clear any prior history
        self.client.post("/api/assistant/history/clear")

        # Send a civic question
        q_res = self.client.post("/api/assistant", json={
            "question": "How do I apply for a ration card in Delhi?",
            "language": "English"
        })
        self.assertEqual(q_res.status_code, 200)

        # Retrieve saved history
        hist_res = self.client.get("/api/assistant/history")
        self.assertEqual(hist_res.status_code, 200)
        hist_data = hist_res.get_json()
        self.assertTrue(hist_data["success"])
        self.assertTrue(hist_data["authenticated"])
        self.assertEqual(hist_data["citizen_name"], "Vikramaditya Rao")
        self.assertGreaterEqual(len(hist_data["history"]), 1)
        self.assertIn("ration card", hist_data["history"][-1]["question"].lower())

        # Clear history
        clear_res = self.client.post("/api/assistant/history/clear")
        self.assertEqual(clear_res.status_code, 200)
        hist_after = self.client.get("/api/assistant/history").get_json()
        self.assertEqual(len(hist_after["history"]), 0)

    def test_33_unauthenticated_history_and_no_name(self):
        """Guest user: /api/assistant/history returns empty list and authenticated=False"""
        self.client.get("/logout")
        res = self.client.get("/api/assistant/history")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertFalse(data.get("authenticated", False))
        self.assertEqual(len(data["history"]), 0)


if __name__ == "__main__":
    unittest.main()

