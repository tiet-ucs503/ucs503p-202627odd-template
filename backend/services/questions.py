"""
Deterministic question generator (ported from the old frontend QuestionGenerator.ts).

Every question is built from random numbers and its answer is computed, so the
answer is always right. The server keeps `correct_index`; the client only ever
receives the text and the four options.

Phase A: one difficulty tier ("medium"). Phase C adds easy and hard.
"""
import random
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class GeneratedQuestion:
    text: str
    options: List[str]
    correct_index: int
    hint: str
    difficulty: str = "medium"


def _fmt(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else str(n)


def _build(text: str, answer: float, distractors: List[float], hint: str,
           rng: random.Random, difficulty: str) -> GeneratedQuestion:
    """Four distinct options containing the answer exactly once, in random order."""
    options: List[float] = [answer]
    for d in distractors:
        if d not in options and len(options) < 4:
            options.append(d)
    step = 1
    while len(options) < 4:  # distractors collided; pad with nearby numbers
        for candidate in (answer + step, answer - step):
            if candidate not in options and len(options) < 4:
                options.append(candidate)
        step += 1
    rng.shuffle(options)
    return GeneratedQuestion(
        text=text,
        options=[_fmt(o) for o in options],
        correct_index=options.index(answer),
        hint=hint,
        difficulty=difficulty,
    )


def _goblin(rng: random.Random, difficulty: str) -> GeneratedQuestion:
    a, y, b = rng.randint(2, 10), rng.randint(2, 11), rng.randint(1, 20)
    add = rng.random() > 0.5
    c = a * y + b if add else a * y - b
    op = "+" if add else "-"
    text = (
        "SPIDER SENSE ALERT\n\nGreen Goblin has encrypted Oscorp's security system.\n\n"
        f"Solve:\n{a}Y {op} {b} = {c}\n\nFind Y to disable the attack."
    )
    hint = (
        f"Move the constant to the other side first: {'subtract' if add else 'add'} {b} "
        f"on both sides, then divide by {a}."
    )
    return _build(text, y, [y + 1, y - 1, y + 2, y * 2], hint, rng, difficulty)


def _doc_ock(rng: random.Random, difficulty: str) -> GeneratedQuestion:
    w = rng.randint(3, 12)
    length = w + rng.randint(1, 10)
    if rng.random() > 0.5:
        area = w * length
        text = (
            "DOC OCK THREAT\n\nDoc Ock is building a mechanical lab.\n\n"
            f"The rectangular lab is {w}m wide and {length}m long.\n\nWhat is the total Area?"
        )
        hint = f"Area of a rectangle is width x length. Multiply {w} by {length}."
        return _build(text, area, [w + length, 2 * (w + length), area + 10, area - 5], hint, rng, difficulty)
    perimeter = 2 * (w + length)
    text = (
        "DOC OCK THREAT\n\nDoc Ock's tentacles need a wire around the lab.\n\n"
        f"The lab is {w}m wide and {length}m long.\n\nWhat is the Perimeter?"
    )
    hint = f"Perimeter of a rectangle is 2 x (width + length). Add {w} and {length}, then double it."
    return _build(text, perimeter, [w * length, w + length, perimeter + 2, perimeter - 4], hint, rng, difficulty)


def _mysterio(rng: random.Random, difficulty: str) -> GeneratedQuestion:
    start = rng.randint(2, 6)
    if rng.random() > 0.5:
        ratio = rng.randint(2, 3)
        seq = [start * ratio ** i for i in range(4)]
        nxt = seq[3] * ratio
        text = (
            "MYSTERIO ILLUSION\n\nMysterio's mirror maze shifts in a pattern.\n\n"
            f"Observe the sequence: {seq[0]}, {seq[1]}, {seq[2]}, {seq[3]}...\n\n"
            "What is the next number to break the illusion?"
        )
        hint = "Look for a multiplication pattern. What do you multiply each number by to get the next?"
        return _build(text, nxt, [nxt + ratio, nxt - ratio, nxt * 2, nxt + start], hint, rng, difficulty)
    diff = rng.randint(3, 12)
    seq = [start + diff * i for i in range(4)]
    nxt = seq[3] + diff
    text = (
        "MYSTERIO ILLUSION\n\nThe drones are spawning in a sequence.\n\n"
        f"Observe the sequence: {seq[0]}, {seq[1]}, {seq[2]}, {seq[3]}...\n\n"
        "What is the next number to stop the drones?"
    )
    hint = "Look for an addition pattern. What do you add to each number to get the next?"
    return _build(text, nxt, [nxt + 1, nxt - 2, nxt + diff, nxt * 2], hint, rng, difficulty)


def _venom(rng: random.Random, difficulty: str) -> GeneratedQuestion:
    total = rng.randint(2, 6) * 100
    percent = rng.randint(1, 4) * 15
    covered = percent * total // 100  # total is a multiple of 100, so this is exact
    text = (
        "SYMBIOTE OUTBREAK\n\nVenom's symbiote is spreading rapidly!\n\n"
        f"It has covered {percent}% of a {total} sq ft laboratory.\n\nHow many square feet are covered?"
    )
    hint = f"To find {percent}% of {total}, divide {percent} by 100 and multiply by {total}."
    return _build(text, covered, [covered + 10, covered - 20, total - covered, covered * 2], hint, rng, difficulty)


def _lizard(rng: random.Random, difficulty: str) -> GeneratedQuestion:
    base, exp = rng.randint(2, 5), rng.randint(2, 3)
    root = rng.randint(2, 9)
    square = root * root
    add = rng.random() > 0.5
    power = base ** exp
    answer = power + root if add else power - root
    op = "+" if add else "-"
    text = (
        "MUTATION THREAT\n\nThe Lizard is mixing a new serum formula.\n\n"
        f"Calculate the dosage:\n{base}^{exp} {op} √{square} = ?\n\nFind the value to neutralize the serum!"
    )
    hint = (
        f"Work out {base}^{exp} first ({base} multiplied by itself {exp} times), "
        f"then the square root of {square}, then {'add' if add else 'subtract'}."
    )
    return _build(text, answer, [answer + 2, answer - 2, answer + base, answer * 2], hint, rng, difficulty)


def _kingpin(rng: random.Random, difficulty: str) -> GeneratedQuestion:
    x1, y1, k = rng.randint(2, 6), rng.randint(3, 7), rng.randint(2, 5)
    x2, y2 = x1 * k, y1 * k
    text = (
        "UNDERWORLD TAKEOVER\n\nKingpin is transferring funds proportionally.\n\n"
        f"The ratio is {x1} : {y1} = {x2} : X.\n\nWhat is the value of X to intercept the transfer?"
    )
    hint = f"{x1} multiplied by what gives {x2}? Multiply {y1} by that same number."
    return _build(text, y2, [y2 + y1, y2 - x1, y2 + k, y2 * 2], hint, rng, difficulty)


_GENERATORS = {
    "goblin": _goblin,
    "doc-ock": _doc_ock,
    "mysterio": _mysterio,
    "venom": _venom,
    "lizard": _lizard,
    "kingpin": _kingpin,
}


def generate_question(boss_id: str, difficulty: str = "medium",
                      rng: Optional[random.Random] = None) -> GeneratedQuestion:
    if boss_id not in _GENERATORS:
        raise ValueError(f"Unknown boss: {boss_id}")
    return _GENERATORS[boss_id](rng or random.Random(), difficulty)
