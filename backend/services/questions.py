"""
Deterministic question generator: six topics, three difficulty tiers each.

Every question is built from random numbers and its answer is computed, so the
answer is always right (tests/test_questions.py re-solves thousands of them
independently). The server keeps `correct_index`; the client only ever receives
the text and the four options.

About half the questions are "story" questions told through the villain's own
world (services/story_questions.py). They are built the same way: random
numbers, computed answer. If this generator ever fails, the game serves a fixed
backup question instead (services/question_bank.py).

Each question also carries a plain hint written from the same numbers. That
hint is what Gwen says when no AI service is configured, and it is the only
maths the AI is allowed to rephrase when one is (see services/hints.py).
"""
import random
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

DIFFICULTIES = ("easy", "medium", "hard")


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
           rng: random.Random) -> GeneratedQuestion:
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
    )


def _coin(rng: random.Random) -> bool:
    return rng.random() > 0.5


# ── Green Goblin: linear equations ───────────────────────────────────────────
_GOBLIN_INTRO = "SPIDER SENSE ALERT\n\nGreen Goblin has encrypted Oscorp's security system.\n\nSolve:\n"
_GOBLIN_OUTRO = "\n\nFind Y to disable the attack."


def _goblin_easy(rng):
    y = rng.randint(2, 12)
    if _coin(rng):  # one step: add or subtract
        b = rng.randint(2, 15)
        add = _coin(rng)
        if add:
            c = y + b
        else:  # keep the right-hand side positive: choose it, then work out Y
            c = rng.randint(1, 10)
            y = c + b
        equation = f"Y {'+' if add else '-'} {b} = {c}"
        hint = f"Undo the {'+' if add else '-'} {b}: {'subtract' if add else 'add'} {b} on both sides."
        wrong = [c + b if add else c - b, y + 1, y - 1, y + 2]
    else:  # one step: divide
        a = rng.randint(2, 9)
        equation = f"{a}Y = {a * y}"
        hint = f"{a}Y means {a} times Y. Divide both sides by {a}."
        wrong = [a * y - a, a * y + a, y + 1, y - 1]
    return _build(_GOBLIN_INTRO + equation + _GOBLIN_OUTRO, y, wrong, hint, rng)


def _goblin_medium(rng):
    a, y = rng.randint(2, 10), rng.randint(2, 11)
    add = _coin(rng)
    b = rng.randint(1, 20) if add else rng.randint(1, min(20, a * y - 1))  # right-hand side stays positive
    c = a * y + b if add else a * y - b
    equation = f"{a}Y {'+' if add else '-'} {b} = {c}"
    hint = (f"Move the constant to the other side first: {'subtract' if add else 'add'} {b} "
            f"on both sides, then divide by {a}.")
    return _build(_GOBLIN_INTRO + equation + _GOBLIN_OUTRO, y, [y + 1, y - 1, y + 2, y * 2], hint, rng)


def _goblin_hard(rng):
    y = rng.randint(2, 12)
    if _coin(rng):  # brackets
        a, b = rng.randint(2, 6), rng.randint(1, 9)
        add = _coin(rng)
        if not add:
            y = b + rng.randint(1, 9)  # keep the bracket positive
        c = a * (y + b) if add else a * (y - b)
        equation = f"{a}(Y {'+' if add else '-'} {b}) = {c}"
        hint = f"Divide both sides by {a} first, then {'subtract' if add else 'add'} {b}."
        wrong = [c // a, y + b, abs(y - b) + 1, y + 1]
    else:  # Y on both sides
        c_coef = rng.randint(1, 5)
        a = c_coef + rng.randint(1, 5)
        b = rng.randint(1, 12)
        d = (a - c_coef) * y + b
        equation = f"{a}Y + {b} = {c_coef}Y + {d}"
        hint = (f"Collect the Y terms on one side: subtract {c_coef}Y from both sides, "
                f"then subtract {b}, then divide.")
        wrong = [d - b, y + 1, y - 1, y * 2]
    return _build(_GOBLIN_INTRO + equation + _GOBLIN_OUTRO, y, wrong, hint, rng)


# ── Doctor Octopus: area and perimeter ───────────────────────────────────────
def _rectangle(rng, w: int, length: int):
    if _coin(rng):
        area = w * length
        text = ("DOC OCK THREAT\n\nDoc Ock is building a mechanical lab.\n\n"
                f"The rectangular lab is {w}m wide and {length}m long.\n\nWhat is the total Area?")
        hint = f"Area of a rectangle is width x length. Multiply {w} by {length}."
        return _build(text, area, [w + length, 2 * (w + length), area + 10, area - 5], hint, rng)
    perimeter = 2 * (w + length)
    text = ("DOC OCK THREAT\n\nDoc Ock's tentacles need a wire around the lab.\n\n"
            f"The lab is {w}m wide and {length}m long.\n\nWhat is the Perimeter?")
    hint = f"Perimeter of a rectangle is 2 x (width + length). Add {w} and {length}, then double it."
    return _build(text, perimeter, [w * length, w + length, perimeter + 2, perimeter - 4], hint, rng)


def _doc_ock_easy(rng):
    w = rng.randint(2, 6)
    return _rectangle(rng, w, w + rng.randint(1, 4))


def _doc_ock_medium(rng):
    w = rng.randint(3, 12)
    return _rectangle(rng, w, w + rng.randint(1, 10))


def _doc_ock_hard(rng):
    if _coin(rng):  # triangle
        base, height = 2 * rng.randint(2, 8), rng.randint(3, 12)
        area = base * height // 2
        text = ("DOC OCK THREAT\n\nDoc Ock is welding a triangular panel with a base of "
                f"{base}m and a height of {height}m.\n\nWhat is the Area of the panel?")
        hint = f"Area of a triangle is half of base x height. Multiply {base} by {height}, then halve it."
        return _build(text, area, [base * height, base + height, area + base, area - 2], hint, rng)
    w = rng.randint(3, 9)  # work backwards from the perimeter
    length = w + rng.randint(1, 8)
    perimeter, area = 2 * (w + length), w * length
    text = ("DOC OCK THREAT\n\nDoc Ock's rectangular lab has a perimeter of "
            f"{perimeter}m and a width of {w}m.\n\nWhat is the Area of the lab?")
    hint = (f"Half the perimeter is width + length, so the length is {perimeter} / 2 - {w}. "
            "Then multiply width by length.")
    return _build(text, area, [perimeter * w, (perimeter - w) * w, length, perimeter // 2], hint, rng)


# ── Mysterio: sequences and patterns ─────────────────────────────────────────
def _arithmetic(rng, start: int, diff: int):
    seq = [start + diff * i for i in range(4)]
    nxt = seq[3] + diff
    text = ("MYSTERIO ILLUSION\n\nThe drones are spawning in a sequence.\n\n"
            f"Observe the sequence: {seq[0]}, {seq[1]}, {seq[2]}, {seq[3]}...\n\n"
            "What is the next number to stop the drones?")
    hint = "Look for an addition pattern. What do you add to each number to get the next?"
    return _build(text, nxt, [nxt + 1, nxt - 2, nxt + diff, nxt * 2], hint, rng)


def _mysterio_easy(rng):
    return _arithmetic(rng, rng.randint(1, 5), rng.randint(2, 5))


def _mysterio_medium(rng):
    start = rng.randint(2, 6)
    if _coin(rng):
        return _arithmetic(rng, start, rng.randint(3, 12))
    ratio = rng.randint(2, 3)
    seq = [start * ratio ** i for i in range(4)]
    nxt = seq[3] * ratio
    text = ("MYSTERIO ILLUSION\n\nMysterio's mirror maze shifts in a pattern.\n\n"
            f"Observe the sequence: {seq[0]}, {seq[1]}, {seq[2]}, {seq[3]}...\n\n"
            "What is the next number to break the illusion?")
    hint = "Look for a multiplication pattern. What do you multiply each number by to get the next?"
    return _build(text, nxt, [nxt + ratio, nxt - ratio, nxt * 2, nxt + start], hint, rng)


def _mysterio_hard(rng):
    start, diff, n = rng.randint(2, 9), rng.randint(3, 9), rng.choice([8, 9, 10, 12])
    seq = [start + diff * i for i in range(4)]
    answer = start + (n - 1) * diff
    text = ("MYSTERIO ILLUSION\n\nMysterio hides his real position far along a pattern.\n\n"
            f"Observe the sequence: {seq[0]}, {seq[1]}, {seq[2]}, {seq[3]}...\n\n"
            f"What is the {n}th number in the sequence?")
    hint = (f"Each step adds {diff}. To reach the {n}th number from the 1st you take {n - 1} steps, "
            "not " + str(n) + ".")
    return _build(text, answer, [start + n * diff, answer - diff, n * diff, answer + start], hint, rng)


# ── Venom: percentages ───────────────────────────────────────────────────────
def _percent_of(rng, percent: int, total: int):
    covered = percent * total // 100
    text = ("SYMBIOTE OUTBREAK\n\nVenom's symbiote is spreading rapidly!\n\n"
            f"It has covered {percent}% of a {total} sq ft laboratory.\n\nHow many square feet are covered?")
    hint = f"To find {percent}% of {total}, divide {percent} by 100 and multiply by {total}."
    return _build(text, covered, [covered + 10, covered - 20, total - covered, covered * 2], hint, rng)


def _venom_easy(rng):
    return _percent_of(rng, rng.choice([10, 25, 50]), rng.randint(1, 10) * 20)


def _venom_medium(rng):
    return _percent_of(rng, rng.randint(1, 4) * 15, rng.randint(2, 6) * 100)


def _venom_hard(rng):
    if _coin(rng):  # percentage increase
        base, percent = rng.randint(2, 6) * 100, rng.choice([10, 20, 25, 40])
        answer = base * (100 + percent) // 100
        text = ("SYMBIOTE OUTBREAK\n\n"
                f"The symbiote covered {base} sq ft, then grew by {percent}%.\n\n"
                "How many square feet does it cover now?")
        hint = f"Find {percent}% of {base} first, then add it on to the {base}."
        wrong = [base * percent // 100, base + percent, base * (100 - percent) // 100, answer + 10]
        return _build(text, answer, wrong, hint, rng)
    total, percent = rng.choice([20, 40, 50, 200]), rng.choice([20, 30, 40, 60, 70, 80])
    part = total * percent // 100  # one number as a percentage of another
    text = ("SYMBIOTE OUTBREAK\n\n"
            f"Venom has infected {part} of the {total} lab computers.\n\n"
            "What percentage of the computers is infected?")
    hint = f"Divide the part by the whole, {part} / {total}, then multiply by 100."
    return _build(text, percent, [part, 100 - percent, percent + 10, percent - 10], hint, rng)


# ── The Lizard: exponents and radicals ───────────────────────────────────────
_LIZARD_INTRO = "MUTATION THREAT\n\nThe Lizard is mixing a new serum formula.\n\nCalculate the dosage:\n"
_LIZARD_OUTRO = "\n\nFind the value to neutralize the serum!"


def _lizard_easy(rng):
    if _coin(rng):
        base = rng.randint(2, 9)
        answer = base * base
        expression = f"{base}^2 = ?"
        hint = f"{base}^2 means {base} multiplied by itself, not {base} times 2."
        wrong = [base * 2, answer + base, answer - 1, base + 2]
    else:
        root = rng.randint(2, 10)
        answer = root
        expression = f"√{root * root} = ?"
        hint = f"Which number multiplied by itself gives {root * root}?"
        wrong = [root * root // 2, root + 1, root - 1, root * 2]
    return _build(_LIZARD_INTRO + expression + _LIZARD_OUTRO, answer, wrong, hint, rng)


def _lizard_medium(rng):
    base, exp, root = rng.randint(2, 5), rng.randint(2, 3), rng.randint(2, 9)
    add = _coin(rng)
    power = base ** exp
    answer = power + root if add else power - root
    expression = f"{base}^{exp} {'+' if add else '-'} √{root * root} = ?"
    hint = (f"Work out {base}^{exp} first ({base} multiplied by itself {exp} times), "
            f"then the square root of {root * root}, then {'add' if add else 'subtract'}.")
    return _build(_LIZARD_INTRO + expression + _LIZARD_OUTRO, answer,
                  [answer + 2, answer - 2, answer + base, answer * 2], hint, rng)


def _lizard_hard(rng):
    base = rng.randint(2, 3)
    if _coin(rng):  # product rule
        m, n = rng.randint(1, 3), rng.randint(2, 3)
        answer = base ** (m + n)
        expression = f"{base}^{m} × {base}^{n} = ?"
        hint = f"Same base, so add the powers: {base}^{m} × {base}^{n} = {base}^({m}+{n})."
        wrong = [base ** (m * n), (base * base) ** (m + n), base * (m + n), answer + base]
    else:  # power of a power
        m = rng.randint(2, 3)
        answer = base ** (2 * m)
        expression = f"({base}^{m})^2 = ?"
        hint = f"A power of a power multiplies the powers: ({base}^{m})^2 = {base}^({m}×2)."
        wrong = [base ** (m + 2), base ** m * 2, base * m * 2, answer - base]
    return _build(_LIZARD_INTRO + expression + _LIZARD_OUTRO, answer, wrong, hint, rng)


# ── Kingpin: ratios and proportions ──────────────────────────────────────────
def _proportion(rng, x1: int, y1: int, k: int):
    x2, y2 = x1 * k, y1 * k
    text = ("UNDERWORLD TAKEOVER\n\nKingpin is transferring funds proportionally.\n\n"
            f"The ratio is {x1} : {y1} = {x2} : X.\n\nWhat is the value of X to intercept the transfer?")
    hint = f"{x1} multiplied by what gives {x2}? Multiply {y1} by that same number."
    return _build(text, y2, [y2 + y1, y2 - x1, y2 + k, y2 * 2], hint, rng)


def _kingpin_easy(rng):
    return _proportion(rng, 1, rng.randint(2, 6), rng.randint(2, 9))


def _kingpin_medium(rng):
    return _proportion(rng, rng.randint(2, 6), rng.randint(3, 7), rng.randint(2, 5))


def _kingpin_hard(rng):
    a = rng.randint(2, 7)
    b = rng.choice([n for n in range(2, 8) if n != a])
    k = rng.randint(5, 20)
    total, answer = (a + b) * k, a * k
    text = ("UNDERWORLD TAKEOVER\n\n"
            f"Kingpin splits ${total} between two gangs in the ratio {a} : {b}.\n\n"
            "How many dollars does the first gang get?")
    hint = (f"The ratio has {a} + {b} = {a + b} equal parts. Find the size of one part, "
            f"then take {a} of them.")
    return _build(text, answer, [b * k, total // a, total // (a + b), total - a], hint, rng)


Generator = Callable[[random.Random], GeneratedQuestion]

# The share of questions told as a villain story rather than as a plain sum.
STORY_SHARE = 0.5

_GENERATORS: Dict[str, Dict[str, Generator]] = {
    "goblin": {"easy": _goblin_easy, "medium": _goblin_medium, "hard": _goblin_hard},
    "doc-ock": {"easy": _doc_ock_easy, "medium": _doc_ock_medium, "hard": _doc_ock_hard},
    "mysterio": {"easy": _mysterio_easy, "medium": _mysterio_medium, "hard": _mysterio_hard},
    "venom": {"easy": _venom_easy, "medium": _venom_medium, "hard": _venom_hard},
    "lizard": {"easy": _lizard_easy, "medium": _lizard_medium, "hard": _lizard_hard},
    "kingpin": {"easy": _kingpin_easy, "medium": _kingpin_medium, "hard": _kingpin_hard},
}


def generate_question(boss_id: str, difficulty: str = "medium",
                      rng: Optional[random.Random] = None) -> GeneratedQuestion:
    if boss_id not in _GENERATORS:
        raise ValueError(f"Unknown boss: {boss_id}")
    if difficulty not in DIFFICULTIES:
        raise ValueError(f"Unknown difficulty: {difficulty}")
    from services.story_questions import STORIES  # imported here: that module builds on this one

    rng = rng or random.Random()
    if rng.random() < STORY_SHARE:
        question = rng.choice(STORIES[boss_id][difficulty])(rng)
    else:
        question = _GENERATORS[boss_id][difficulty](rng)
    question.difficulty = difficulty
    return question
