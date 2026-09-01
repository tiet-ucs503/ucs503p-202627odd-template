"""Basic smoke tests - expand as features are added."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app  # noqa: E402


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
