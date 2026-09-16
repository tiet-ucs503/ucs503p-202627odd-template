BASELINE_PAYLOAD = {
    "limb_ratios": {"femurToTorso": 0.9, "shinToTorso": 0.8},
    "rom": {"kneeStanding": 175.0, "kneeBottom": 80.0, "hipStanding": 170.0, "hipBottom": 70.0},
    "angle_stats": {"knee": {"mean": 95.0, "std": 5.2}},
}


def test_calibration_missing_returns_404(client, auth_headers):
    resp = client.get("/api/calibration", headers=auth_headers)
    assert resp.status_code == 404


def test_calibration_upsert_and_fetch_roundtrip(client, auth_headers):
    post_resp = client.post("/api/calibration", json=BASELINE_PAYLOAD, headers=auth_headers)
    assert post_resp.status_code == 200, post_resp.text
    body = post_resp.json()
    assert body["limb_ratios"] == BASELINE_PAYLOAD["limb_ratios"]
    assert body["rom"] == BASELINE_PAYLOAD["rom"]
    assert body["angle_stats"] == BASELINE_PAYLOAD["angle_stats"]
    assert "calibrated_at" in body

    get_resp = client.get("/api/calibration", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["limb_ratios"] == BASELINE_PAYLOAD["limb_ratios"]


def test_calibration_upsert_overwrites_previous(client, auth_headers):
    client.post("/api/calibration", json=BASELINE_PAYLOAD, headers=auth_headers)

    updated = {
        "limb_ratios": {"femurToTorso": 1.1, "shinToTorso": 0.95},
        "rom": {"kneeStanding": 180.0, "kneeBottom": 75.0, "hipStanding": 172.0, "hipBottom": 65.0},
        "angle_stats": {"knee": {"mean": 100.0, "std": 4.1}},
    }
    resp = client.post("/api/calibration", json=updated, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["limb_ratios"] == updated["limb_ratios"]

    get_resp = client.get("/api/calibration", headers=auth_headers)
    assert get_resp.json()["limb_ratios"] == updated["limb_ratios"]


def test_calibration_requires_auth(client):
    resp = client.get("/api/calibration")
    assert resp.status_code == 401
    resp = client.post("/api/calibration", json=BASELINE_PAYLOAD)
    assert resp.status_code == 401


def test_calibration_ownership_isolation(client, register_user):
    token_a, _ = register_user(username="cal_a")
    token_b, _ = register_user(username="cal_b")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.post("/api/calibration", json=BASELINE_PAYLOAD, headers=headers_a)

    # User B has no baseline of their own, even though A just created one.
    resp_b = client.get("/api/calibration", headers=headers_b)
    assert resp_b.status_code == 404

    resp_a = client.get("/api/calibration", headers=headers_a)
    assert resp_a.status_code == 200
