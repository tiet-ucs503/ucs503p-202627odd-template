"""
tests/test_eligibility.py - Comprehensive Unit & Integration Test Suite for Feature 1
Smart Government Scheme Eligibility Checker
"""

import os
import sys
import unittest
import json

# Ensure project root is in sys.path
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(TEST_DIR)
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from app import app, DB_PATH
from utils import eligibility


class TestSmartEligibilityChecker(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()

    # -------------------------------------------------------------
    # 1. Page & Route Tests
    # -------------------------------------------------------------
    def test_eligibility_page_render(self):
        """Verify GET /eligibility renders the interactive checker with disclaimer."""
        response = self.client.get("/eligibility")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn("Smart Government Scheme Eligibility Checker", html)
        self.assertIn("Pre-Screening Disclaimer", html)
        self.assertIn("Select Category or Scheme of Interest", html)
        self.assertIn("Citizen Profile Questions", html)
        self.assertIn("compareModal", html)

    def test_api_questions_agriculture(self):
        """Verify dynamic questions for agriculture only ask farm-relevant questions."""
        response = self.client.get("/api/eligibility/questions?category=agriculture")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("questions", data)
        q_ids = [q["id"] for q in data["questions"]]
        self.assertIn("farmer_status", q_ids)
        self.assertIn("land_size_hectares", q_ids)
        self.assertIn("annual_income", q_ids)
        # Should NOT ask student questions
        self.assertNotIn("student_status", q_ids)
        self.assertNotIn("education_level", q_ids)

    def test_api_questions_education(self):
        """Verify dynamic questions for education only ask student-relevant questions."""
        response = self.client.get("/api/eligibility/questions?category=education")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        q_ids = [q["id"] for q in data["questions"]]
        self.assertIn("student_status", q_ids)
        self.assertIn("education_level", q_ids)
        self.assertIn("social_category", q_ids)
        # Should NOT ask farmer or business questions
        self.assertNotIn("farmer_status", q_ids)
        self.assertNotIn("land_size_hectares", q_ids)
        self.assertNotIn("business_status", q_ids)

    def test_api_questions_pension(self):
        """Verify dynamic questions for senior citizen & pensions."""
        response = self.client.get("/api/eligibility/questions?category=pension_senior")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        q_ids = [q["id"] for q in data["questions"]]
        self.assertIn("age", q_ids)
        self.assertIn("employment_status", q_ids)
        self.assertIn("annual_income", q_ids)

    def test_api_questions_specific_service(self):
        """Verify dynamic questions for a specific service ID (e.g. 136 = PM-KISAN)."""
        response = self.client.get("/api/eligibility/questions?service_id=136")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["service_id"], 136)
        q_ids = [q["id"] for q in data["questions"]]
        self.assertIn("farmer_status", q_ids)
        self.assertIn("annual_income", q_ids)

    # -------------------------------------------------------------
    # 2. Fully Eligible Citizen Scenarios
    # -------------------------------------------------------------
    def test_eligible_farmer_pm_kisan(self):
        """Citizen meeting all farmer conditions qualifies for PM-KISAN & Agriculture schemes."""
        profile = {
            "state": "Punjab",
            "district": "Ludhiana",
            "age": 42,
            "farmer_status": "yes_landowner",
            "land_size_hectares": "marginal",
            "annual_income": 120000,
            "institutional_taxpayer": "no"
        }
        res = eligibility.match_schemes(profile, category_key="agriculture", db_path=DB_PATH)
        self.assertGreater(res["summary"]["confirmed_eligible_count"], 0)
        
        # Verify PM-KISAN is confirmed eligible
        pm_kisan_matches = [s for s in res["confirmed_eligible"] if "PM-KISAN" in s["name"]]
        self.assertTrue(len(pm_kisan_matches) > 0)
        kisan = pm_kisan_matches[0]
        self.assertEqual(kisan["status"], "confirmed_eligible")
        self.assertIn("Confirmed Eligible", kisan["status_badge"])
        self.assertIn("₹6,000", kisan["benefits"])
        self.assertTrue(len(kisan["documents_list"]) > 0)
        self.assertTrue(len(kisan["steps"]) > 0)
        self.assertIn("https://", kisan["source_url"])
        self.assertIn("statutory", kisan["disclaimer"].lower())

    def test_eligible_student_scholarships(self):
        """Enrolled student with low income qualifies for scholarships."""
        profile = {
            "state": "Uttar Pradesh",
            "age": 20,
            "student_status": "yes",
            "education_level": "undergraduate",
            "social_category": "obc",
            "annual_income": 180000
        }
        res = eligibility.match_schemes(profile, category_key="education", db_path=DB_PATH)
        self.assertGreater(res["summary"]["confirmed_eligible_count"], 0)
        nsp_matches = [s for s in res["confirmed_eligible"] if "National Scholarship" in s["name"]]
        self.assertTrue(len(nsp_matches) > 0)
        self.assertIn("Direct Benefit Transfer", nsp_matches[0]["benefits"])

    def test_eligible_senior_citizen(self):
        """Citizen aged 65 qualifies for Senior Citizen Certificate and Pension."""
        profile = {
            "state": "Maharashtra",
            "age": 65,
            "employment_status": "senior_retired",
            "annual_income": 40000,
            "gender": "male"
        }
        res = eligibility.match_schemes(profile, category_key="pension_senior", db_path=DB_PATH)
        senior_schemes = [s for s in res["confirmed_eligible"] if "Senior Citizen" in s["name"]]
        self.assertTrue(len(senior_schemes) > 0)
        self.assertEqual(senior_schemes[0]["status"], "confirmed_eligible")

    # -------------------------------------------------------------
    # 3. Failing Condition Scenarios (Ineligible)
    # -------------------------------------------------------------
    def test_ineligible_underage_for_senior_pension(self):
        """Citizen aged 28 is strictly disqualified from Senior Citizen Pension."""
        profile = {
            "state": "Haryana",
            "age": 28,
            "employment_status": "working",
            "annual_income": 60000
        }
        res = eligibility.match_schemes(profile, category_key="pension_senior", db_path=DB_PATH)
        ineligible_names = [s["name"] for s in res["ineligible"]]
        self.assertIn("Senior Citizen Pension", ineligible_names)
        self.assertIn("Senior Citizen Certificate / Identity Card", ineligible_names)
        
        # Check condition failure message
        card_match = [s for s in res["ineligible"] if s["name"] == "Senior Citizen Pension"][0]
        self.assertIn("requires minimum 60 years", card_match["why_qualified"])

    def test_ineligible_income_exceeds_ews_threshold(self):
        """Citizen with annual income of ₹12,00,000 is disqualified from EWS Certificate."""
        profile = {
            "state": "Delhi",
            "age": 25,
            "annual_income": 1200000,
            "social_category": "general"
        }
        res = eligibility.match_schemes(profile, category_key="identity_civil", db_path=DB_PATH)
        ews_matches = [s for s in res["ineligible"] if "EWS" in s["name"]]
        self.assertTrue(len(ews_matches) > 0)
        self.assertIn("exceeds EWS ceiling", ews_matches[0]["conditions_failed"][0])

    def test_ineligible_owning_pucca_house_for_pmay(self):
        """Citizen owning a permanent pucca house is disqualified from PMAY housing schemes."""
        profile = {
            "state": "Rajasthan",
            "age": 35,
            "annual_income": 200000,
            "owns_pucca_house": "yes"
        }
        res = eligibility.match_schemes(profile, category_key="housing", db_path=DB_PATH)
        pmay_ineligible = [s for s in res["ineligible"] if "Awas" in s["name"] or "Housing" in s["name"]]
        self.assertTrue(len(pmay_ineligible) > 0)
        self.assertIn("already owns a permanent (pucca) house", pmay_ineligible[0]["conditions_failed"][0])

    def test_ineligible_male_for_widow_pension(self):
        """Male citizen is disqualified from Widow Pension."""
        profile = {
            "state": "Delhi",
            "age": 62,
            "gender": "male",
            "marital_status": "widowed",
            "annual_income": 30000
        }
        res = eligibility.match_schemes(profile, category_key="pension_senior", db_path=DB_PATH)
        widow_ineligible = [s for s in res["ineligible"] if "Widow Pension" in s["name"]]
        self.assertTrue(len(widow_ineligible) > 0)
        self.assertIn("reserved exclusively for female applicants", widow_ineligible[0]["conditions_failed"][0])

    # -------------------------------------------------------------
    # 4. Incomplete Profile & Follow-up Questions
    # -------------------------------------------------------------
    def test_incomplete_profile_triggers_followups(self):
        """When age or critical fields are missing, status is 'insufficient_info' with follow-up questions."""
        # Missing age and employment status
        profile = {
            "state": "Karnataka",
            "annual_income": 50000
        }
        res = eligibility.match_schemes(profile, category_key="pension_senior", db_path=DB_PATH)
        self.assertGreater(res["summary"]["insufficient_info_count"], 0)
        
        sample_followup = res["insufficient_info"][0]
        self.assertEqual(sample_followup["status"], "insufficient_info")
        self.assertEqual(sample_followup["status_badge"], "Follow-up Needed")
        self.assertTrue(len(sample_followup["follow_up_questions"]) > 0)
        self.assertTrue(any("age" in q.lower() for q in sample_followup["follow_up_questions"]))

    # -------------------------------------------------------------
    # 5. Clear Explanation When No Schemes Match
    # -------------------------------------------------------------
    def test_no_match_explanation_generation(self):
        """When criteria disqualify all schemes in category, returns comprehensive no-match explanation."""
        # Age 15, income 25 Lakhs, male in women_child
        profile = {
            "state": "Goa",
            "age": 15,
            "gender": "male",
            "annual_income": 2500000
        }
        res = eligibility.match_schemes(profile, category_key="women_child", db_path=DB_PATH)
        self.assertIsNotNone(res["no_match_explanation"])
        expl = res["no_match_explanation"]
        self.assertIn("No Matching Schemes Found", expl["title"])
        self.assertTrue(len(expl["remediation"]) >= 3)

    # -------------------------------------------------------------
    # 6. Multi-Scheme Comparison Feature
    # -------------------------------------------------------------
    def test_scheme_comparison_matrix(self):
        """Compare 3 schemes side-by-side and verify structure."""
        service_ids = [136, 63, 64]  # PM-KISAN, Ayushman Bharat PM-JAY, etc.
        matrix = eligibility.build_comparison_matrix(service_ids, db_path=DB_PATH)
        self.assertNotIn("error", matrix)
        self.assertEqual(len(matrix["schemes"]), 3)
        self.assertTrue(len(matrix["fields"]) >= 8)
        
        field_keys = [f["key"] for f in matrix["fields"]]
        self.assertIn("name", field_keys)
        self.assertIn("benefits", field_keys)
        self.assertIn("eligibility", field_keys)
        self.assertIn("documents_required", field_keys)
        self.assertIn("source_url", field_keys)

    def test_api_comparison_endpoint(self):
        """POST /api/eligibility/compare with service IDs."""
        response = self.client.post("/api/eligibility/compare", json={"service_ids": [51, 52]})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(len(data["schemes"]), 2)

    def test_api_comparison_empty(self):
        """POST /api/eligibility/compare without IDs returns 400."""
        response = self.client.post("/api/eligibility/compare", json={"service_ids": []})
        self.assertEqual(response.status_code, 400)

    # -------------------------------------------------------------
    # 7. Non-Regression & Statutory Disclaimer Tests
    # -------------------------------------------------------------
    def test_statutory_disclaimer_present(self):
        """Statutory disclaimer must be present in evaluator responses to never guarantee approval."""
        profile = {"state": "Punjab", "age": 40, "farmer_status": "yes_landowner", "annual_income": 100000}
        res = eligibility.match_schemes(profile, category_key="agriculture", db_path=DB_PATH)
        self.assertIn("BharatAssist does not guarantee government approval", res["disclaimer"])
        for sc in res["confirmed_eligible"]:
            self.assertIn("does not guarantee government approval", sc["disclaimer"])

    def test_all_226_services_preserved(self):
        """Ensure all 226 services are evaluated when category is 'all'."""
        profile = {"state": "All India", "age": 30, "annual_income": 300000}
        res = eligibility.match_schemes(profile, category_key="all", db_path=DB_PATH)
        self.assertEqual(res["summary"]["total_evaluated"], 226)


if __name__ == "__main__":
    unittest.main()
