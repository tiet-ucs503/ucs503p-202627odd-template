"""
tests/test_readiness.py - Comprehensive Unit & Integration Test Suite for Feature 2
Document Readiness Checker
"""

import io
import os
import sys
import unittest
import json

TEST_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(TEST_DIR)
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from app import app, DB_PATH
from utils import readiness


class TestDocumentReadinessChecker(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()

    # -------------------------------------------------------------
    # 1. Page and Endpoint Routing Tests
    # -------------------------------------------------------------
    def test_readiness_page_render(self):
        """GET /document-readiness renders the checklist assistant with disclaimer."""
        response = self.client.get("/document-readiness")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn("Document Readiness Checker", html)
        self.assertIn("Statutory Non-Acceptance Notice", html)
        self.assertIn("Select Government Service or Scheme", html)
        self.assertIn("readinessGaugeCard", html)

    def test_readiness_page_with_service_id(self):
        """GET /document-readiness?service_id=51 preselects the requested service."""
        response = self.client.get("/document-readiness?service_id=51")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn("PAN Card Application", html)

    def test_api_requirements_specific_service(self):
        """GET /api/readiness/requirements/51 returns parsed specific checklist."""
        response = self.client.get("/api/readiness/requirements/51")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["service_name"], "PAN Card Application")
        self.assertFalse(data["is_unverified_fallback"])
        self.assertTrue(len(data["documents"]) >= 3)
        self.assertIn("Statutory", data["disclaimer"])

    def test_api_requirements_generic_unverified_service(self):
        """GET /api/readiness/requirements/136 (PM-KISAN) handles generic catalog entry with fallback."""
        response = self.client.get("/api/readiness/requirements/136")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["is_unverified_fallback"])
        self.assertEqual(len(data["documents"]), 4)
        doc_names = [d["name"] for d in data["documents"]]
        self.assertIn("Proof of Identity (PoI)", doc_names)
        self.assertIn("Proof of Address / Domicile (PoA)", doc_names)

    def test_api_requirements_nonexistent_service(self):
        """GET /api/readiness/requirements/999999 returns 404."""
        response = self.client.get("/api/readiness/requirements/999999")
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertFalse(data["success"])

    # -------------------------------------------------------------
    # 2. Text Analysis: Expiry, Blur, Name Inconsistency & Fields
    # -------------------------------------------------------------
    def test_expired_document_detection(self):
        """Detect expired date and flag document as expired with warning."""
        text = "GOVERNMENT OF NCT OF DELHI DRIVING LICENCE Holder: Ramesh Kumar Valid Till: 15/05/2019 Category: LMV"
        res = readiness.analyze_document_text(text, doc_name="Driving Licence", applicant_name="Ramesh Kumar")
        self.assertTrue(res["is_expired"])
        self.assertEqual(res["expiry_date"], "15/05/2019")
        self.assertIn("EXPIRED", res["expiry_warning"])

    def test_valid_unexpired_document(self):
        """Document with future expiry date is recognized as valid."""
        future_year = 2035
        text = f"PASSPORT OF INDIA Name: Sunil Sharma Date of Expiry: 20/12/{future_year} Passport No: Z1234567"
        res = readiness.analyze_document_text(text, doc_name="Passport", applicant_name="Sunil Sharma")
        self.assertFalse(res["is_expired"])
        self.assertIsNone(res["expiry_warning"])

    def test_blurry_unreadable_scan_detection(self):
        """Detect blurry scans with fewer than 3 readable words or high noise."""
        blurry_text = "x $ #"
        res = readiness.analyze_document_text(blurry_text, doc_name="Aadhaar Card")
        self.assertTrue(res["is_unreadable"])
        self.assertIn("blurry, truncated, or unreadable", res["blur_warning"])

    def test_name_inconsistency_detection(self):
        """Detect mismatch between applicant profile name and document holder name."""
        text = "INCOME TAX DEPARTMENT GOVT OF INDIA Permanent Account Number Card Name: Amit Vikram Verma Father: S. K. Verma"
        res = readiness.analyze_document_text(text, doc_name="PAN Card", applicant_name="Pooja Sundaram")
        self.assertTrue(res["name_inconsistency"])
        self.assertIn("Name mismatch detected", res["name_warning"])

    def test_name_consistency_passed(self):
        """Matching applicant name passes consistency check."""
        text = "INCOME TAX DEPARTMENT GOVT OF INDIA Name: Rajesh Kumar DOB: 14/08/1988 PAN: ABCDE1234F"
        res = readiness.analyze_document_text(text, doc_name="PAN Card", applicant_name="Rajesh Kumar")
        self.assertFalse(res["name_inconsistency"])
        self.assertIsNone(res["name_warning"])

    def test_missing_mandatory_pan_format(self):
        """If document is marked as PAN Card but lacks alphanumeric PAN, flag missing field."""
        text = "Government document without standard permanent account number structure."
        res = readiness.analyze_document_text(text, doc_name="PAN Card Application")
        self.assertTrue(any("PAN" in f for f in res["missing_fields"]))

    # -------------------------------------------------------------
    # 3. Privacy & PII Redaction
    # -------------------------------------------------------------
    def test_pii_protection_in_analysis_preview(self):
        """Verify that sensitive PII (Aadhaar, PAN, Phone) is masked in preview output."""
        text = "Aadhaar Number: 4321 8765 1098 PAN: ABCDE1234F Mobile: 9876543210 Name: Ramesh Kumar"
        res = readiness.analyze_document_text(text, doc_name="Identity Proof", applicant_name="Ramesh Kumar")
        preview = res["redacted_preview"]
        self.assertNotIn("4321 8765 1098", preview)
        self.assertNotIn("ABCDE1234F", preview)
        self.assertNotIn("9876543210", preview)
        self.assertIn("[REDACTED_", preview)

    # -------------------------------------------------------------
    # 4. Overall Readiness Evaluation Scenarios
    # -------------------------------------------------------------
    def test_readiness_ready_status(self):
        """When all required documents are available and valid, status is 'Ready' (100%)."""
        svc = {"id": 51, "name": "PAN Card Application", "source_url": "https://incometax.gov.in"}
        docs = [
            {"id": "doc_0", "name": "Proof of Identity", "status": "available", "analysis": {}},
            {"id": "doc_1", "name": "Proof of Address", "status": "available", "analysis": {}},
            {"id": "doc_2", "name": "Proof of Date of Birth", "status": "available", "analysis": {}}
        ]
        res = readiness.evaluate_overall_readiness(svc, docs)
        self.assertEqual(res["readiness_status"], "Ready")
        self.assertEqual(res["readiness_score"], 100)
        self.assertEqual(res["missing_count"], 0)
        self.assertEqual(res["issue_count"], 0)
        self.assertIn("All required documents are prepared", res["summary_text"])

    def test_readiness_partially_ready_status(self):
        """When some documents are available but 1 is missing, status is 'Partially ready'."""
        svc = {"id": 51, "name": "PAN Card Application"}
        docs = [
            {"id": "doc_0", "name": "Proof of Identity", "status": "available", "analysis": {}},
            {"id": "doc_1", "name": "Proof of Address", "status": "missing", "analysis": {}},
            {"id": "doc_2", "name": "Proof of Date of Birth", "status": "available", "analysis": {}}
        ]
        res = readiness.evaluate_overall_readiness(svc, docs)
        self.assertEqual(res["readiness_status"], "Partially ready")
        self.assertEqual(res["readiness_score"], 66)
        self.assertEqual(res["missing_count"], 1)
        self.assertTrue(len(res["actionable_next_steps"]) >= 1)
        self.assertIn("Proof of Address", res["actionable_next_steps"][0])

    def test_readiness_not_ready_status(self):
        """When critical documents are missing or expired, status is 'Not ready' (0%)."""
        svc = {"id": 51, "name": "PAN Card Application"}
        docs = [
            {"id": "doc_0", "name": "Proof of Identity", "status": "expired", "analysis": {"is_expired": True, "expiry_date": "01/01/2020"}},
            {"id": "doc_1", "name": "Proof of Address", "status": "missing", "analysis": {}}
        ]
        res = readiness.evaluate_overall_readiness(svc, docs)
        self.assertEqual(res["readiness_status"], "Not ready")
        self.assertEqual(res["readiness_score"], 0)
        self.assertTrue(len(res["actionable_next_steps"]) >= 2)

    # -------------------------------------------------------------
    # 5. API Upload and Evaluate Integration Tests
    # -------------------------------------------------------------
    def test_api_upload_text_file(self):
        """POST /api/readiness/upload with valid text file."""
        file_content = b"GOVT OF INDIA DRIVING LICENCE Name: Sunil Sharma Valid Till: 15/08/2030"
        data = {
            "file": (io.BytesIO(file_content), "licence.txt"),
            "doc_id": "doc_0",
            "doc_name": "Driving Licence",
            "applicant_name": "Sunil Sharma"
        }
        response = self.client.post("/api/readiness/upload", data=data, content_type="multipart/form-data")
        self.assertEqual(response.status_code, 200)
        res = response.get_json()
        self.assertTrue(res["success"])
        self.assertFalse(res["analysis"]["is_expired"])
        self.assertFalse(res["analysis"]["name_inconsistency"])

    def test_api_upload_expired_document(self):
        """POST /api/readiness/upload with expired document file."""
        file_content = b"STATE EXCISE PERMIT Name: Anita Gupta Expiry Date: 01/01/2018"
        data = {
            "file": (io.BytesIO(file_content), "permit.txt"),
            "doc_id": "doc_1",
            "doc_name": "Excise Permit",
            "applicant_name": "Anita Gupta"
        }
        response = self.client.post("/api/readiness/upload", data=data, content_type="multipart/form-data")
        self.assertEqual(response.status_code, 200)
        res = response.get_json()
        self.assertTrue(res["analysis"]["is_expired"])

    def test_api_evaluate_endpoint(self):
        """POST /api/readiness/evaluate returns structured readiness summary."""
        payload = {
            "service_id": 51,
            "applicant_profile": {"name": "Ramesh Kumar"},
            "documents": [
                {"id": "doc_0", "name": "Proof of Identity", "status": "available", "analysis": {}},
                {"id": "doc_1", "name": "Proof of Address", "status": "available", "analysis": {}},
                {"id": "doc_2", "name": "Proof of Date of Birth", "status": "missing", "analysis": {}}
            ]
        }
        response = self.client.post("/api/readiness/evaluate", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["evaluation"]["readiness_status"], "Partially ready")

    # -------------------------------------------------------------
    # 6. Printable Checklist View Test
    # -------------------------------------------------------------
    def test_printable_checklist_view(self):
        """GET /document-readiness/print/51 renders printable document checklist."""
        response = self.client.get("/document-readiness/print/51")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn("BharatAssist Citizen Document Checklist", html)
        self.assertIn("PAN Card Application", html)
        self.assertIn("Statutory Notice:", html)
        self.assertIn("window.print()", html)


if __name__ == "__main__":
    unittest.main()
