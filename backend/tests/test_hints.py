import inspect

import pytest

from config import settings
from services import hints

QUESTION = "Solve:\n3Y + 5 = 20\n\nFind Y to disable the attack."
PLAIN = "Move the constant to the other side first: subtract 5 on both sides, then divide by 3."


def hint():
    return hints.hint_for(QUESTION, "linear_equations", PLAIN)


def test_without_an_api_key_the_built_in_hint_is_used(monkeypatch):
    monkeypatch.setattr(settings, "groq_api_key", "")
    monkeypatch.setattr(hints, "_ask_model", lambda *a: pytest.fail("the AI service must not be called"))
    assert hint() == PLAIN


def test_ai_wording_is_used_when_available(monkeypatch):
    monkeypatch.setattr(settings, "groq_api_key", "test-key")
    monkeypatch.setattr(hints, "_ask_model", lambda *a: "Easy, Spidey: take 5 off both sides, then split by 3.")
    assert hint() == "Easy, Spidey: take 5 off both sides, then split by 3."


@pytest.mark.parametrize("bad_result", [None, "", "x" * 2000])
def test_unusable_ai_output_falls_back_to_the_built_in_hint(monkeypatch, bad_result):
    monkeypatch.setattr(settings, "groq_api_key", "test-key")
    monkeypatch.setattr(hints, "_ask_model", lambda *a: bad_result)
    assert hint() == PLAIN


def test_ai_failure_falls_back_to_the_built_in_hint(monkeypatch):
    def boom(*args):
        raise TimeoutError("service too slow")

    monkeypatch.setattr(settings, "groq_api_key", "test-key")
    monkeypatch.setattr(hints, "_ask_model", boom)
    assert hint() == PLAIN


def test_hints_take_no_attention_input():
    assert list(inspect.signature(hints.hint_for).parameters) == ["question_text", "topic", "plain_hint"]
    code = inspect.getsource(hints).split('"""')[2]
    for word in ("cognitive", "on_screen", "face_present", "blink"):
        assert word not in code


def test_game_is_fully_playable_with_no_ai_service(monkeypatch, client, register, win_mission):
    """No GROQ_API_KEY: missions, hints and victory all still work."""
    monkeypatch.setattr(settings, "groq_api_key", "")
    student = register()
    res = client.post("/sessions", json={"boss_id": "goblin"}, headers=student.headers).json()
    hint_res = client.get(f"/attempts/{res['question']['attempt_id']}/hint", headers=student.headers)
    assert hint_res.status_code == 200 and len(hint_res.json()["hint"]) > 10
    assert win_mission(student)["session_status"] == "victory"
