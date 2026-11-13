import json
import os
import sqlite3
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, DB_PATH, init_users_table

class UserProfileAndApplicationsTestCase(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        app.config["SECRET_KEY"] = "test-secret-key"
        init_users_table()
        self.client = app.test_client()

    def test_01_unauthenticated_redirects(self):
        self.assertEqual(self.client.get("/profile").status_code, 302)
        self.assertEqual(self.client.get("/applications").status_code, 302)
        self.assertEqual(self.client.get("/chat-history").status_code, 302)

    def test_02_profile_and_account_lifecycle(self):
        # 1. Register a test citizen
        test_phone = "9812345678"
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE phone = ?", (test_phone,))
            cursor.execute("""
                INSERT INTO users (phone, name, email, preferred_language, state, district, password_hash, is_verified)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """, (test_phone, "Arun Kumar", "arun@example.com", "Hindi", "Punjab", "Ludhiana", "scrypt:32768:8:1$fakehash", ))
            user_id = cursor.lastrowid
            conn.commit()

        # 2. Set authenticated session
        with self.client.session_transaction() as sess:
            sess["user"] = {
                "id": user_id,
                "phone": test_phone,
                "masked_phone": "+91 98••• ••678",
                "name": "Arun Kumar",
                "is_verified": True
            }

        # 3. Access profile page
        resp = self.client.get("/profile")
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b"Arun Kumar", resp.data)

        # 4. Update profile details
        update_resp = self.client.post("/api/profile/update", json={
            "name": "Arun K. Sharma",
            "email": "arun.sharma@example.gov.in",
            "preferred_language": "English",
            "state": "Haryana",
            "district": "Gurugram",
            "phone": test_phone
        })
        self.assertEqual(update_resp.status_code, 200)
        data = json.loads(update_resp.data)
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["name"], "Arun K. Sharma")

        # Verify in DB
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name, email, state, district FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            self.assertEqual(row[0], "Arun K. Sharma")
            self.assertEqual(row[1], "arun.sharma@example.gov.in")
            self.assertEqual(row[2], "Haryana")
            self.assertEqual(row[3], "Gurugram")

        # 5. Save an application
        cursor = sqlite3.connect(DB_PATH).cursor()
        cursor.execute("SELECT id FROM services LIMIT 1")
        svc_row = cursor.fetchone()
        self.assertIsNotNone(svc_row)
        service_id = svc_row[0]

        save_resp = self.client.post("/api/applications/save", json={"service_id": service_id})
        self.assertEqual(save_resp.status_code, 200)
        save_data = json.loads(save_resp.data)
        self.assertTrue(save_data["success"])
        app_id = save_data["application_id"]

        # 6. View My Applications & Application Checklist
        apps_resp = self.client.get("/applications")
        self.assertEqual(apps_resp.status_code, 200)

        chk_resp = self.client.get(f"/applications/{app_id}")
        self.assertEqual(chk_resp.status_code, 200)

        # 7. Toggle a checklist step
        toggle_resp = self.client.post(f"/api/applications/{app_id}/toggle-step", json={
            "item_id": "step_0",
            "item_type": "step",
            "completed": 1
        })
        self.assertEqual(toggle_resp.status_code, 200)
        toggle_data = json.loads(toggle_resp.data)
        self.assertTrue(toggle_data["success"])
        self.assertGreaterEqual(toggle_data["done_count"], 1)
        self.assertIn(toggle_data["current_status"], ["In progress", "Submitted"])

        # 8. Update status to Submitted
        status_resp = self.client.post(f"/api/applications/{app_id}/status", json={"status": "Submitted"})
        self.assertEqual(status_resp.status_code, 200)
        status_data = json.loads(status_resp.data)
        self.assertEqual(status_data["status"], "Submitted")

        # 9. Test Chat History & Conversation Thread
        chat_post = self.client.post("/api/assistant", json={
            "question": "Hello BharatAssist",
            "language": "English"
        })
        self.assertEqual(chat_post.status_code, 200)
        chat_post_data = json.loads(chat_post.data)
        conv_id = chat_post_data.get("conversation_id")
        self.assertIsNotNone(conv_id)

        conv_list_resp = self.client.get("/api/conversations")
        self.assertEqual(conv_list_resp.status_code, 200)
        conv_list = json.loads(conv_list_resp.data)["conversations"]
        self.assertTrue(any(c["id"] == conv_id for c in conv_list))

        conv_detail_resp = self.client.get(f"/api/conversations/{conv_id}")
        self.assertEqual(conv_detail_resp.status_code, 200)
        self.assertGreaterEqual(len(json.loads(conv_detail_resp.data)["messages"]), 1)

        # 10. Delete account test
        delete_resp = self.client.post("/api/profile/delete-account", json={"confirm_text": "DELETE"})
        self.assertEqual(delete_resp.status_code, 200)
        delete_data = json.loads(delete_resp.data)
        self.assertTrue(delete_data["success"])

        # Confirm user, applications, and conversations deleted from DB
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            self.assertIsNone(cursor.fetchone())
            cursor.execute("SELECT id FROM user_applications WHERE user_id = ?", (user_id,))
            self.assertIsNone(cursor.fetchone())
            cursor.execute("SELECT id FROM chat_conversations WHERE user_id = ?", (user_id,))
            self.assertIsNone(cursor.fetchone())

if __name__ == "__main__":
    unittest.main()
