"""Checks stored answer rows after a camera test run (frontend/scripts/camera-check.mjs).

Given the answers the browser sent, as JSON: [{"id": 12, "measured": true}, ...]
it reads those rows from the development database and checks two things:

1. Attention columns are filled only where the camera measured something, and
   are NULL (never 0) where it did not.
2. Each row's mastery_after is exactly what the mastery model gives from
   mastery_before and whether the answer was correct. Attention plays no part.

It only reads. Run from backend/:  python tools/verify_attempts.py '[...]'
"""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from services.mastery import update_mastery  # noqa: E402

ATTENTION = ["face_present_pct", "on_screen_pct", "blink_rate_per_min", "attention_score", "attention_label"]


def main() -> None:
    sent = json.loads(sys.argv[1])
    db = sqlite3.connect(Path(__file__).resolve().parent.parent / "mathverse.db")
    db.row_factory = sqlite3.Row
    rows = {r["id"]: r for r in db.execute(
        f"select * from attempts where id in ({','.join('?' * len(sent))})", [s["id"] for s in sent])}

    missing = [s["id"] for s in sent if s["id"] not in rows]
    wrong_null, wrong_filled, wrong_mastery = [], [], []
    for s in sent:
        row = rows.get(s["id"])
        if row is None:
            continue
        if s["measured"]:
            if row["face_present_pct"] is None or row["on_screen_pct"] is None:
                wrong_null.append(s["id"])
        elif any(row[c] is not None for c in ATTENTION):
            wrong_filled.append(s["id"])
        expected = update_mastery(row["mastery_before"], bool(row["is_correct"]))
        if abs(expected - row["mastery_after"]) > 1e-9:
            wrong_mastery.append(s["id"])

    measured = sum(1 for s in sent if s["measured"])
    print(json.dumps([
        {"check": "every answer sent was stored", "pass": not missing, "detail": f"{len(sent)} rows" if not missing else f"missing {missing}"},
        {"check": "rows answered with the camera on have attention numbers", "pass": not wrong_null, "detail": f"{measured} rows" if not wrong_null else f"empty in {wrong_null}"},
        {"check": "rows answered without the camera are NULL in all attention columns, never 0", "pass": not wrong_filled, "detail": f"{len(sent) - measured} rows" if not wrong_filled else f"filled in {wrong_filled}"},
        {"check": "mastery after each answer follows from correctness alone", "pass": not wrong_mastery, "detail": f"{len(sent)} rows recomputed" if not wrong_mastery else f"differs in {wrong_mastery}"},
    ]))


if __name__ == "__main__":
    main()
