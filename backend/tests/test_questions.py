"""
Every generated question must have a correct stored answer.

`solve` works the answer out again from the question text alone, using its own
arithmetic, and the tests compare that with what the generator stored. This is
run for all six bosses at all three difficulty tiers, hundreds of times each.
"""
import math
import random
import re

import pytest

from services.curriculum import BOSS_IDS
from services.questions import DIFFICULTIES, generate_question

SEEDS = range(300)
CASES = [(boss, tier) for boss in BOSS_IDS for tier in DIFFICULTIES]


def solve(boss_id: str, text: str) -> int:
    """Independently works out the answer from the question text."""
    def find(pattern):
        match = re.search(pattern, text)
        return match.groups() if match else None

    if boss_id == "goblin":
        if g := find(r"grabbed (\d+) more\.\nNow he carries (\d+)"):  # Y + b = c
            return int(g[1]) - int(g[0])
        if g := find(r"In (\d+) seconds it covers (\d+) metres"):  # aY = c
            assert int(g[1]) % int(g[0]) == 0
            return int(g[1]) // int(g[0])
        if g := find(r"(\d+) times Y, (plus|minus) (\d+), equals (\d+)"):  # aY ± b = c
            a, b, c = int(g[0]), int(g[2]), int(g[3])
            top = c - b if g[1] == "plus" else c + b
            assert top % a == 0
            return top // a
        if g := find(r"(\d+) vials were filled and (\d+) drops spilled, leaving (\d+) drops"):  # aY - b = c
            a, b, c = map(int, g)
            assert (c + b) % a == 0
            return (c + b) // a
        if g := find(r"packs (\d+) crates\. Each crate holds Y pumpkin bombs and (\d+) smoke bombs\.\n"
                     r"There are (\d+) bombs"):  # a(Y + b) = c
            a, b, c = map(int, g)
            assert c % a == 0
            return c // a - b
        if g := find(r"swings (\d+)Y \+ (\d+) metres\. The Goblin Glider flies (\d+)Y \+ (\d+) metres"):
            a, b, c, d = map(int, g)  # aY + b = cY + d, told as a race
            assert (d - b) % (a - c) == 0
            return (d - b) // (a - c)
        if g := find(r"(\d+)Y \+ (\d+) = (\d+)Y \+ (\d+)"):  # aY + b = cY + d
            a, b, c, d = map(int, g)
            assert (d - b) % (a - c) == 0
            return (d - b) // (a - c)
        if g := find(r"(\d+)\(Y ([+-]) (\d+)\) = (\d+)"):  # a(Y ± b) = c
            a, b, c = int(g[0]), int(g[2]), int(g[3])
            assert c % a == 0
            return c // a - b if g[1] == "+" else c // a + b
        if g := find(r"(\d+)Y ([+-]) (\d+) = (\d+)"):  # aY ± b = c
            a, b, c = int(g[0]), int(g[2]), int(g[3])
            top = c - b if g[1] == "+" else c + b
            assert top % a == 0
            return top // a
        if g := find(r"(\d+)Y = (\d+)"):  # aY = c
            assert int(g[1]) % int(g[0]) == 0
            return int(g[1]) // int(g[0])
        op, b, c = find(r"\nY ([+-]) (\d+) = (\d+)")  # Y ± b = c
        return int(c) - int(b) if op == "+" else int(c) + int(b)

    if boss_id == "doc-ock":
        if g := find(r"base of (\d+)m and a height of (\d+)m"):
            assert int(g[0]) * int(g[1]) % 2 == 0
            return int(g[0]) * int(g[1]) // 2
        if g := find(r"Each side is (\d+)m"):  # square, perimeter
            return 4 * int(g[0])
        if g := find(r"with sides of (\d+)m"):  # square, area
            return int(g[0]) ** 2
        if g := find(r"Area of (\d+) sq m and a width of (\d+)m"):  # rectangle, perimeter from area
            area, w = map(int, g)
            assert area % w == 0
            return 2 * (w + area // w)
        if g := find(r"perimeter of (\d+)m and a width of (\d+)m"):
            perimeter, w = map(int, g)
            assert perimeter % 2 == 0
            return w * (perimeter // 2 - w)
        w, length = map(int, find(r"(\d+)m wide and (\d+)m long"))
        return w * length if "Area" in text else 2 * (w + length)

    if boss_id == "mysterio":
        if g := find(r"pattern: (\d+), (\d+), \?, (\d+), (\d+)"):  # the hidden middle number
            a, b, d, e = map(int, g)
            assert e - d == b - a and d - b == 2 * (b - a)
            return b + (b - a)
        s = list(map(int, find(r"sequence: (\d+), (\d+), (\d+), (\d+)")))
        arithmetic = s[1] - s[0] == s[2] - s[1] == s[3] - s[2]
        if g := find(r"What is the (\d+)th number"):
            assert arithmetic
            return s[0] + (int(g[0]) - 1) * (s[1] - s[0])
        if arithmetic:
            return s[3] + (s[1] - s[0])
        assert s[1] * s[1] == s[0] * s[2] and s[2] * s[2] == s[1] * s[3]
        return s[3] * s[1] // s[0]

    if boss_id == "venom":
        if g := find(r"covered (\d+) sq ft, then grew by (\d+)%"):
            base, percent = map(int, g)
            assert base * percent % 100 == 0
            return base + base * percent // 100
        if g := find(r"infected (\d+) of the (\d+) lab computers"):
            part, total = map(int, g)
            assert part * 100 % total == 0
            return part * 100 // total
        if g := find(r"weighed (\d+) kg\. After absorbing energy he grew by (\d+)%"):
            base, percent = map(int, g)
            assert base * percent % 100 == 0
            return base + base * percent // 100
        if g := find(r"checked (\d+) photos and (\d+) were"):
            total, part = map(int, g)
            assert part * 100 % total == 0
            return part * 100 // total
        if g := find(r"has (\d+) ml of web fluid\. Venom's attack burns (\d+)%"):
            total, percent = map(int, g)
            assert percent * total % 100 == 0
            return percent * total // 100
        if g := find(r"(\d+)% of (?:Eddie Brock's|his|the symbiote's) (\d+) "):
            percent, total = map(int, g)
            assert percent * total % 100 == 0
            return percent * total // 100
        percent, total = map(int, find(r"(\d+)% of a (\d+) sq ft"))
        assert percent * total % 100 == 0
        return percent * total // 100

    if boss_id == "lizard":
        if g := find(r"\((\d+)\^(\d+)\)\^(\d+) = \?"):
            return (int(g[0]) ** int(g[1])) ** int(g[2])
        if g := find(r"(\d+)\^(\d+) × (\d+)\^(\d+) = \?"):
            return int(g[0]) ** int(g[1]) * int(g[2]) ** int(g[3])
        if g := find(r"(\d+)\^(\d+) ([+-]) √(\d+) = \?"):
            root = math.isqrt(int(g[3]))
            assert root * root == int(g[3])
            power = int(g[0]) ** int(g[1])
            return power + root if g[2] == "+" else power - root
        if g := find(r"(\d+)\^(\d+) = \?"):
            return int(g[0]) ** int(g[1])
        (square,) = find(r"√(\d+) = \?")
        root = math.isqrt(int(square))
        assert root * root == int(square)
        return root

    if boss_id == "kingpin":
        if g := find(r"Kingpin posts (\d+) outside\.\nThere are (\d+) guards inside"):
            return int(g[0]) * int(g[1])
        if g := find(r"1 gold chip is worth (\d+) silver chips\.\n\nHow many silver chips are (\d+) gold"):
            return int(g[0]) * int(g[1])
        if g := find(r"(\d+) (?:crates|bodyguards) for every (\d+) (?:barrels|lawyers)\.\n"
                     r"(?:A convoy carries|He has) (\d+) "):
            x1, y1, x2 = map(int, g)
            assert y1 * x2 % x1 == 0
            return y1 * x2 // x1
        if g := find(r"controls (\d+) city blocks\. He shares them with Hammerhead in the ratio (\d+) : (\d+)"):
            total, a, b = map(int, g)
            assert total % (a + b) == 0
            return total // (a + b) * a  # Kingpin's share is the first number
        if g := find(r"share \$(\d+) in the ratio (\d+) : (\d+)\.\n\nHow many dollars does Vanessa"):
            total, a, b = map(int, g)
            assert total % (a + b) == 0
            return total // (a + b) * b  # Vanessa's share is the second number
        if g := find(r"splits \$(\d+) between two gangs in the ratio (\d+) : (\d+)"):
            total, a, b = map(int, g)
            assert total % (a + b) == 0
            return total // (a + b) * a
        x1, y1, x2 = map(int, find(r"ratio is (\d+) : (\d+) = (\d+) : X"))
        assert y1 * x2 % x1 == 0
        return y1 * x2 // x1

    raise AssertionError(boss_id)


@pytest.mark.parametrize("boss_id,difficulty", CASES)
def test_stored_answer_is_mathematically_correct(boss_id, difficulty):
    for seed in SEEDS:
        q = generate_question(boss_id, difficulty, rng=random.Random(seed))
        assert q.options[q.correct_index] == str(solve(boss_id, q.text)), (seed, q.text, q.options)


@pytest.mark.parametrize("boss_id,difficulty", CASES)
def test_four_distinct_options_with_the_answer_exactly_once(boss_id, difficulty):
    positions = set()
    for seed in SEEDS:
        q = generate_question(boss_id, difficulty, rng=random.Random(seed))
        assert len(q.options) == 4 and len(set(q.options)) == 4
        assert 0 <= q.correct_index <= 3
        assert q.hint and q.difficulty == difficulty
        positions.add(q.correct_index)
    assert positions == {0, 1, 2, 3}  # the answer is not always in the same place


@pytest.mark.parametrize("boss_id,difficulty", CASES)
def test_hint_never_states_the_answer_outright(boss_id, difficulty):
    for seed in SEEDS:
        q = generate_question(boss_id, difficulty, rng=random.Random(seed))
        answer = q.options[q.correct_index]
        assert not re.search(rf"(is|=|equals|answer:?)\s*{re.escape(answer)}\b\.?$", q.hint), (q.text, q.hint)


@pytest.mark.parametrize("boss_id", BOSS_IDS)
def test_tiers_are_genuinely_different(boss_id):
    """Harder tiers use question forms that the easy tier never produces."""
    def texts(tier):
        return {re.sub(r"\d+", "N", generate_question(boss_id, tier, rng=random.Random(s)).text) for s in SEEDS}

    easy, hard = texts("easy"), texts("hard")
    assert easy.isdisjoint(hard) or boss_id in ("doc-ock",), boss_id
    assert hard - easy  # hard always has at least one form of its own


def test_unknown_boss_or_tier_is_an_error():
    with pytest.raises(ValueError):
        generate_question("thanos")
    with pytest.raises(ValueError):
        generate_question("goblin", "impossible")
