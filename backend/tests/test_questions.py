"""Every generated question must have a correct stored answer, checked by re-solving it."""
import math
import random
import re

import pytest

from services.curriculum import BOSS_IDS
from services.questions import generate_question

SEEDS = range(300)


def ints(text: str):
    return [int(n) for n in re.findall(r"-?\d+", text)]


def solve(boss_id: str, text: str) -> int:
    """Independently works out the answer from the question text."""
    if boss_id == "goblin":
        a, op, b, c = re.search(r"(\d+)Y ([+-]) (\d+) = (-?\d+)", text).groups()
        a, b, c = int(a), int(b), int(c)
        return (c - b) // a if op == "+" else (c + b) // a
    if boss_id == "doc-ock":
        w, length = map(int, re.search(r"(\d+)m wide and (\d+)m long", text).groups())
        return w * length if "Area" in text else 2 * (w + length)
    if boss_id == "mysterio":
        s = list(map(int, re.search(r"sequence: (\d+), (\d+), (\d+), (\d+)", text).groups()))
        if s[1] - s[0] == s[2] - s[1] == s[3] - s[2]:
            return s[3] + (s[1] - s[0])
        assert s[1] * s[1] == s[0] * s[2] and s[2] * s[2] == s[1] * s[3]
        return s[3] * s[1] // s[0]
    if boss_id == "venom":
        percent, total = map(int, re.search(r"(\d+)% of a (\d+) sq ft", text).groups())
        return percent * total // 100
    if boss_id == "lizard":
        base, exp, op, square = re.search(r"(\d+)\^(\d+) ([+-]) √(\d+)", text).groups()
        root = math.isqrt(int(square))
        assert root * root == int(square)
        return int(base) ** int(exp) + root if op == "+" else int(base) ** int(exp) - root
    if boss_id == "kingpin":
        x1, y1, x2 = map(int, re.search(r"ratio is (\d+) : (\d+) = (\d+) : X", text).groups())
        return y1 * x2 // x1
    raise AssertionError(boss_id)


@pytest.mark.parametrize("boss_id", BOSS_IDS)
def test_stored_answer_is_mathematically_correct(boss_id):
    for seed in SEEDS:
        q = generate_question(boss_id, rng=random.Random(seed))
        assert q.options[q.correct_index] == str(solve(boss_id, q.text)), (seed, q.text, q.options)


@pytest.mark.parametrize("boss_id", BOSS_IDS)
def test_four_distinct_options_with_the_answer_exactly_once(boss_id):
    positions = set()
    for seed in SEEDS:
        q = generate_question(boss_id, rng=random.Random(seed))
        assert len(q.options) == 4 and len(set(q.options)) == 4
        assert 0 <= q.correct_index <= 3 and q.hint
        positions.add(q.correct_index)
    assert positions == {0, 1, 2, 3}  # the answer is not always in the same place


def test_unknown_boss_is_an_error():
    with pytest.raises(ValueError):
        generate_question("thanos")
