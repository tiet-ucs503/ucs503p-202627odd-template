def test_new_student_report_is_empty_not_invented(client, register):
    student = register("student", "Newcomer")
    r = client.get(f"/students/{student.id}/report", headers=student.headers).json()

    assert r["student_name"] == "Newcomer" and r["is_demo"] is False
    assert r["points"] == 0 and r["level"] == 1
    assert r["questions_answered"] == 0 and r["correct_answers"] == 0
    assert r["accuracy_pct"] is None  # unknown, not 0% and not a sample value
    assert r["practice_minutes"] == 0 and r["missions_won"] == 0 and r["bosses_defeated"] == 0
    assert r["recent_attempts"] == []
    assert len(r["topic_mastery"]) == 6
    assert all(t["mastery_pct"] is None and t["questions_answered"] == 0 for t in r["topic_mastery"])
    assert r["attention"] == {"measured_questions": 0, "total_questions": 0, "avg_on_screen_pct": None}


def test_report_numbers_match_what_was_played(client, register, play):
    student = register()
    attempt_id = client.post("/sessions", json={"boss_id": "goblin"}, headers=student.headers).json()["question"]["attempt_id"]
    outcomes = [True, False, True, True]
    points = 0
    for i, outcome in enumerate(outcomes):
        attention = {"face_present_pct": 100, "on_screen_pct": 60 + 20 * i, "sample_seconds": 5} if i < 2 else None
        body = play(student, attempt_id, outcome, attention=attention)
        points += body["points_awarded"]
        attempt_id = body["next_question"]["attempt_id"]

    r = client.get(f"/students/{student.id}/report", headers=student.headers).json()
    assert r["questions_answered"] == 4 and r["correct_answers"] == 3 and r["accuracy_pct"] == 75
    assert r["points"] == points
    assert r["missions_won"] == 0 and r["missions_played"] == 0  # still in progress
    assert [a["is_correct"] for a in r["recent_attempts"]] == list(reversed(outcomes))

    algebra = next(t for t in r["topic_mastery"] if t["topic"] == "linear_equations")
    assert algebra["questions_answered"] == 4 and algebra["mastery_pct"] is not None
    assert sum(t["questions_answered"] for t in r["topic_mastery"]) == 4

    # attention: averaged over the two measured questions only (60 and 80), the
    # two unmeasured ones are counted as unmeasured rather than as zero
    assert r["attention"] == {"measured_questions": 2, "total_questions": 4, "avg_on_screen_pct": 70}
    assert [a["attention_label"] for a in r["recent_attempts"]] == [None, None, "Focused", "Partly focused"]
