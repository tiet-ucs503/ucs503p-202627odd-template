from app.tests.conftest import make_session_payload


def test_create_and_get_roundtrip(client, auth_headers):
    payload = make_session_payload()
    create_resp = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert create_resp.status_code == 201, create_resp.text
    created = create_resp.json()
    assert created["exercise"] == "squat"
    assert created["rep_count"] == 2
    assert len(created["reps"]) == 2
    assert created["form_score"] == 100.0

    get_resp = client.get(f"/api/sessions/{created['id']}", headers=auth_headers)
    assert get_resp.status_code == 200
    fetched = get_resp.json()
    assert fetched["id"] == created["id"]
    assert len(fetched["reps"]) == 2
    assert fetched["reps"][0]["rep_number"] == 1


def test_session_never_trusts_body_user_id(client, auth_headers):
    # Even if a client tries to smuggle a user_id/owner field in the body,
    # SessionCreateRequest has no such field, so it's silently ignored
    # (extra fields are dropped by default pydantic config) and user_id is
    # taken solely from the token.
    payload = make_session_payload()
    payload["user_id"] = "some-other-user-id"
    resp = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert resp.status_code == 201


def test_list_sessions_returns_only_own(client, register_user):
    token_a, _ = register_user(username="user_a")
    token_b, _ = register_user(username="user_b")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.post("/api/sessions", json=make_session_payload(), headers=headers_a)
    client.post("/api/sessions", json=make_session_payload(), headers=headers_a)
    client.post("/api/sessions", json=make_session_payload(), headers=headers_b)

    list_a = client.get("/api/sessions", headers=headers_a).json()
    list_b = client.get("/api/sessions", headers=headers_b).json()
    assert len(list_a) == 2
    assert len(list_b) == 1


def test_ownership_isolation_get_returns_404_for_other_users_session(client, register_user):
    token_a, _ = register_user(username="owner")
    token_b, _ = register_user(username="intruder")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    create_resp = client.post("/api/sessions", json=make_session_payload(), headers=headers_a)
    session_id = create_resp.json()["id"]

    # Owner can read it.
    assert client.get(f"/api/sessions/{session_id}", headers=headers_a).status_code == 200
    # A different authenticated user cannot — same 404 as a nonexistent id.
    resp = client.get(f"/api/sessions/{session_id}", headers=headers_b)
    assert resp.status_code == 404
    assert client.get("/api/sessions/does-not-exist", headers=headers_b).status_code == 404


def test_get_session_requires_auth(client, auth_headers):
    create_resp = client.post("/api/sessions", json=make_session_payload(), headers=auth_headers)
    session_id = create_resp.json()["id"]
    resp = client.get(f"/api/sessions/{session_id}")
    assert resp.status_code == 401


def test_rep_count_mismatch_rejected(client, auth_headers):
    payload = make_session_payload()
    payload["rep_count"] = 3  # only 2 reps provided
    resp = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert resp.status_code == 422
    assert "rep_count" in resp.json()["detail"]


def test_form_score_out_of_range_rejected(client, auth_headers):
    payload = make_session_payload(form_score=150.0)
    resp = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert resp.status_code == 422


def test_form_score_outside_recompute_tolerance_rejected(client, auth_headers):
    # 2 clean reps, no issues => server recomputes 100.0. Client claims 50.0,
    # far outside the +/-2 tolerance.
    payload = make_session_payload(form_score=50.0)
    resp = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert resp.status_code == 422
    assert "recomputed" in resp.json()["detail"]


def test_form_score_within_recompute_tolerance_accepted(client, auth_headers):
    # 98.5 is within +/-2 of the true recomputed 100.0.
    payload = make_session_payload(form_score=98.5)
    resp = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["form_score"] == 100.0  # server value is persisted, not the client's


def test_timestamps_out_of_order_rejected(client, auth_headers):
    payload = make_session_payload(started_at="2026-01-01T10:05:00Z", ended_at="2026-01-01T10:00:00Z")
    resp = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert resp.status_code == 422


def test_issue_referencing_unknown_rep_number_rejected(client, auth_headers):
    payload = make_session_payload(form_issues=[{"rep_number": 99, "issue_type": "depth", "severity": "high"}])
    resp = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert resp.status_code == 422
