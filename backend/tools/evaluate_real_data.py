"""
Evaluates the mastery model on REAL answers stored in the database.

For every answered question, the database keeps the mastery the model held
just before that answer (attempts.mastery_before). From it the model's
prediction is P(correct) = mastery x (1 - slip) + (1 - mastery) x guess. This
script compares those predictions with what the student actually answered, and
with the same simple baselines as tools/evaluate_mastery.py (the simulation).

Only real accounts are counted. Demo accounts (sample data) and the test
accounts below are left out, because their answers were not made by students.

With too little data the figures are noise, so the script says so instead of
presenting them. Run it again as answers accumulate. It only reads the database.

Run from backend/:
    python tools/evaluate_real_data.py
    python tools/evaluate_real_data.py path/to/other.db
"""
import random
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.mastery import P_GUESS, P_SLIP  # noqa: E402
from tools.evaluate_mastery import auc, prediction_metrics  # noqa: E402

DEFAULT_DB = Path(__file__).resolve().parent.parent / "mathverse.db"

# Accounts used for automated testing, not by students. Add any new test accounts here.
EXCLUDED_EMAILS = {"camera-check@example.com"}

# Below these, results are shown as "not enough data yet" rather than as findings.
MIN_ANSWERS = 200
MIN_STUDENTS = 10

BOOTSTRAP_ROUNDS = 1000


def load_answers(db_path: Path) -> List[dict]:
    """Real students' answered questions, in the order each student answered them."""
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)  # read only
    con.row_factory = sqlite3.Row
    placeholders = ",".join("?" * len(EXCLUDED_EMAILS))
    rows = con.execute(
        f"""
        SELECT a.student_id, a.topic, a.is_correct, a.mastery_before
        FROM attempts a JOIN users u ON u.id = a.student_id
        WHERE a.answered_at IS NOT NULL
          AND a.is_correct IS NOT NULL
          AND a.mastery_before IS NOT NULL
          AND u.role = 'student'
          AND u.is_demo = 0
          AND lower(u.email) NOT IN ({placeholders})
        ORDER BY a.student_id, a.answered_at, a.id
        """,
        sorted(EXCLUDED_EMAILS),
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def _predictions(answers: List[dict], overall_rate: float) -> Dict[str, List[float]]:
    """Each model's prediction for each answer, made only from what came before it."""
    preds: Dict[str, List[float]] = defaultdict(list)
    history: Dict[tuple, List[bool]] = defaultdict(list)  # per student and topic
    for a in answers:
        p = a["mastery_before"]
        past = history[(a["student_id"], a["topic"])]
        preds["BKT (this project)"].append(p * (1 - P_SLIP) + (1 - p) * P_GUESS)
        preds["Running accuracy so far"].append((sum(past) + 1) / (len(past) + 2))
        preds["Last answer only"].append(0.5 if not past else (0.8 if past[-1] else 0.3))
        preds["Constant (overall rate)"].append(overall_rate)
        past.append(bool(a["is_correct"]))
    return preds


def _bootstrap_auc_gap(answers: List[dict], seed: int = 1) -> Optional[tuple]:
    """
    95% interval for (BKT AUC - running-accuracy AUC), resampling whole students,
    since one student's answers are not independent of each other.
    """
    by_student: Dict[int, List[int]] = defaultdict(list)
    for i, a in enumerate(answers):
        by_student[a["student_id"]].append(i)
    students = list(by_student)
    overall = sum(a["is_correct"] for a in answers) / len(answers)
    preds = _predictions(answers, overall)
    labels = [bool(a["is_correct"]) for a in answers]
    rng = random.Random(seed)
    gaps = []
    for _ in range(BOOTSTRAP_ROUNDS):
        idx = [i for s in rng.choices(students, k=len(students)) for i in by_student[s]]
        ys = [labels[i] for i in idx]
        if all(ys) or not any(ys):
            continue
        gaps.append(auc([preds["BKT (this project)"][i] for i in idx], ys)
                    - auc([preds["Running accuracy so far"][i] for i in idx], ys))
    if len(gaps) < BOOTSTRAP_ROUNDS // 2:
        return None
    gaps.sort()
    return gaps[int(len(gaps) * 0.025)], gaps[int(len(gaps) * 0.975)]


def evaluate(db_path: Path = DEFAULT_DB) -> dict:
    answers = load_answers(db_path)
    labels = [bool(a["is_correct"]) for a in answers]
    students = {a["student_id"] for a in answers}
    result = {
        "answers": len(answers),
        "students": len(students),
        "topics": dict(sorted(defaultdict(int, {t: sum(1 for a in answers if a["topic"] == t)
                                                for t in {a["topic"] for a in answers}}).items())),
        "enough_data": len(answers) >= MIN_ANSWERS and len(students) >= MIN_STUDENTS,
        "models": {},
        "auc_gap_ci": None,
    }
    if answers and any(labels) and not all(labels):
        overall = sum(labels) / len(labels)
        result["models"] = {name: prediction_metrics(p, labels) for name, p in _predictions(answers, overall).items()}
        if len(students) >= 2:
            result["auc_gap_ci"] = _bootstrap_auc_gap(answers)
    return result


def main(db_path: Path) -> None:
    r = evaluate(db_path)
    print(f"Real-data evaluation of the mastery model  ({db_path.name})")
    print(f"Answers from real students: {r['answers']}   Students: {r['students']}   "
          f"(demo accounts and {len(EXCLUDED_EMAILS)} test account(s) left out)")
    if r["topics"]:
        print("By topic: " + ", ".join(f"{t} {n}" for t, n in r["topics"].items()))

    if not r["models"]:
        print("\nNothing to evaluate yet: need answers that include both right and wrong ones.")
        return
    if not r["enough_data"]:
        print(f"\nNOT ENOUGH DATA YET. Results need at least {MIN_ANSWERS} answers from {MIN_STUDENTS} students.")
        print("The figures below are shown for checking only. Do not present them as findings.")

    print(f"\n{'model':26s} {'AUC':>6s} {'Acc':>7s} {'Brier':>7s} {'LogLoss':>8s}")
    for model, m in r["models"].items():
        print(f"{model:26s} {m['AUC']:6.3f} {m['Accuracy']:7.1%} {m['Brier']:7.3f} {m['LogLoss']:8.3f}")
    ci = r["auc_gap_ci"]
    if ci:
        verdict = ("BKT is better" if ci[0] > 0 else "BKT is worse" if ci[1] < 0
                   else "no clear difference yet")
        print(f"\nBKT AUC minus running-accuracy AUC, 95% interval: {ci[0]:+.3f} to {ci[1]:+.3f}  ->  {verdict}")
    print("\nPredictions use the mastery stored before each answer; baselines use only earlier answers.")
    print("The constant baseline uses the overall rate of this same data, which slightly favours it.")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DB)
