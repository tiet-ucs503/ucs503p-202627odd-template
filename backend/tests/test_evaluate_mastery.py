"""The mastery evaluation script runs, and the model beats its simple baselines."""
import pytest

from tools.evaluate_mastery import SCENARIOS, auc, evaluate


def test_auc_matches_hand_worked_cases():
    assert auc([0.1, 0.2, 0.8, 0.9], [False, False, True, True]) == 1.0
    assert auc([0.9, 0.8, 0.2, 0.1], [False, False, True, True]) == 0.0
    assert auc([0.5, 0.5, 0.5, 0.5], [False, True, False, True]) == 0.5


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s[0] for s in SCENARIOS])
def test_the_mastery_model_beats_every_baseline(scenario):
    _, prior, guess, slip, learn = scenario
    result = evaluate(800, prior, guess, slip, learn)
    bkt = result["models"]["BKT (this project)"]
    for name, baseline in result["models"].items():
        if name == "BKT (this project)":
            continue
        assert bkt["AUC"] > baseline["AUC"], name
        assert bkt["Brier"] < baseline["Brier"], name
        assert bkt["LogLoss"] < baseline["LogLoss"], name
    assert result["knowledge_auc"] > 0.85
    assert result["difficulty_agreement"] > 0.8
