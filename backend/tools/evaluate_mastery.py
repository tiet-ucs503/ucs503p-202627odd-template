"""
Evaluates the mastery model (services/mastery.py) against simple baselines, on
simulated students.

There is no real-student dataset yet, so this follows the usual approach for
knowledge-tracing models without data: simulate students whose true knowledge
is known, then measure how well each model predicts every next answer before
seeing it. Nothing is stored and the database is not touched.

The simulated students follow standard Bayesian Knowledge Tracing with their
own parameters. The second scenario gives them parameters deliberately
different from the model's, so the model is not graded only on data shaped
like its own assumptions.

Run from backend/:
    python tools/evaluate_mastery.py              # 5,000 students x 20 answers per scenario
    python tools/evaluate_mastery.py 1000         # fewer students, quicker
"""
import math
import random
import sys
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.mastery import (  # noqa: E402  (after the path is set)
    HARD_ABOVE, P_GUESS, P_SLIP, PRIOR, difficulty_for, update_mastery,
)

N_QUESTIONS = 20

SCENARIOS = [
    # name, and the simulated students' own prior, guess, slip and learning rate
    ("Students match the model's assumptions", 0.30, 0.25, 0.10, 0.15),
    ("Students differ from the model (robustness)", 0.20, 0.30, 0.15, 0.10),
]


def simulate(rng: random.Random, prior: float, guess: float, slip: float, learn: float):
    """One student: their hidden known/unknown state before each question, and their answers."""
    known = rng.random() < prior
    states, answers = [], []
    for _ in range(N_QUESTIONS):
        states.append(known)
        answers.append(rng.random() < ((1 - slip) if known else guess))
        if not known and rng.random() < learn:
            known = True
    return states, answers


def auc(scores: List[float], labels: List[bool]) -> float:
    """Area under the ROC curve: the chance a random positive is scored above a random negative."""
    ranked = sorted(zip(scores, labels))
    positives = sum(labels)
    negatives = len(labels) - positives
    rank_sum, i = 0.0, 0
    while i < len(ranked):  # tied scores share their average rank
        j = i
        while j < len(ranked) and ranked[j][0] == ranked[i][0]:
            j += 1
        rank_sum += (i + j + 1) / 2 * sum(1 for k in range(i, j) if ranked[k][1])
        i = j
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def prediction_metrics(predicted: List[float], actual: List[bool]) -> Dict[str, float]:
    eps = 1e-6
    n = len(actual)
    return {
        "AUC": auc(predicted, actual),
        "Accuracy": sum((p >= 0.5) == a for p, a in zip(predicted, actual)) / n,
        "Brier": sum((p - a) ** 2 for p, a in zip(predicted, actual)) / n,
        "LogLoss": -sum(math.log(max(eps, p if a else 1 - p)) for p, a in zip(predicted, actual)) / n,
    }


def evaluate(n_students: int, prior: float, guess: float, slip: float, learn: float, seed: int = 7) -> dict:
    rng = random.Random(seed)
    students = [simulate(rng, prior, guess, slip, learn) for _ in range(n_students)]
    overall_rate = sum(sum(a) for _, a in students) / (n_students * N_QUESTIONS)

    predictions: Dict[str, List[float]] = {
        "BKT (this project)": [], "Running accuracy so far": [], "Last answer only": [], "Constant (overall rate)": [],
    }
    actual: List[bool] = []
    estimates: List[float] = []
    truth: List[bool] = []
    lags: List[int] = []

    for states, answers in students:
        p, right, last = PRIOR, 0, None
        learned_at = recognised_at = None
        for i, (known, correct) in enumerate(zip(states, answers)):
            # Each model predicts this answer before seeing it.
            predictions["BKT (this project)"].append(p * (1 - P_SLIP) + (1 - p) * P_GUESS)
            predictions["Running accuracy so far"].append((right + 1) / (i + 2))  # smoothed: starts at 0.5
            predictions["Last answer only"].append(0.5 if last is None else (0.8 if last else 0.3))
            predictions["Constant (overall rate)"].append(overall_rate)
            actual.append(correct)
            estimates.append(p)
            truth.append(known)

            if known and learned_at is None:
                learned_at = i
            p = update_mastery(p, correct)
            right += correct
            last = correct
            if learned_at is not None and recognised_at is None and p > HARD_ABOVE:
                recognised_at = i
        if learned_at is not None and recognised_at is not None:
            lags.append(recognised_at - learned_at + 1)

    decided = [(difficulty_for(e), k) for e, k in zip(estimates, truth) if difficulty_for(e) != "medium"]
    lags.sort()
    return {
        "predictions": len(actual),
        "models": {name: prediction_metrics(pred, actual) for name, pred in predictions.items()},
        "knowledge_auc": auc(estimates, truth),
        "difficulty_agreement": sum((tier == "hard") == k for tier, k in decided) / len(decided),
        "lag_median": lags[len(lags) // 2],
        "lag_p90": lags[int(len(lags) * 0.9)],
    }


def main(n_students: int = 5000) -> None:
    for name, prior, guess, slip, learn in SCENARIOS:
        r = evaluate(n_students, prior, guess, slip, learn)
        print(f"\n=== {name} ===  ({n_students} students x {N_QUESTIONS} answers = {r['predictions']} predictions)")
        print(f"{'model':26s} {'AUC':>6s} {'Acc':>7s} {'Brier':>7s} {'LogLoss':>8s}")
        for model, m in r["models"].items():
            print(f"{model:26s} {m['AUC']:6.3f} {m['Accuracy']:7.1%} {m['Brier']:7.3f} {m['LogLoss']:8.3f}")
        print(f"Mastery estimate vs the student's true state: AUC {r['knowledge_auc']:.3f}")
        print(f"Easy/hard choices that match the true state: {r['difficulty_agreement']:.1%}")
        print(f"Answers to recognise a student who has learned: median {r['lag_median']}, 90th percentile {r['lag_p90']}")
    print("\nSimulated students, not real data. The model's parameters are textbook defaults, not fitted.")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 5000)
