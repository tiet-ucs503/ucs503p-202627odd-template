"""
Story questions: the same maths as services/questions.py, told through each
villain's own world (the Goblin's glider and pumpkin bombs, Doc Ock's arms and
reactor, Mysterio's illusions, Venom's symbiote, the Lizard's serum, Kingpin's
empire).

They follow the same rules as every other question. The numbers are random,
the answer is computed from them, and the hint is written from the same
numbers. No AI service writes or checks any of this. Each villain has six
stories, two for each difficulty tier, and each tier practises the same skill
as the plain questions of that tier.

tests/test_questions.py re-solves every story from its text alone.
"""
import random
from typing import Callable, Dict, List

from services.questions import GeneratedQuestion, _build, _coin


# ── Green Goblin: linear equations ───────────────────────────────────────────
def _goblin_bombs(rng):  # Y + b = c
    y, b = rng.randint(2, 12), rng.randint(2, 15)
    c = y + b
    text = ("PUMPKIN BOMB ALERT\n\n"
            f"Green Goblin loaded Y pumpkin bombs onto his glider, then grabbed {b} more.\nNow he carries {c}.\n\n"
            "How many did he load first?")
    hint = f"Y + {b} = {c}. Undo the + {b}: subtract {b} from both sides."
    return _build(text, y, [c + b, y + 1, y - 1, y + 2], hint, rng)


def _goblin_glider(rng):  # aY = c
    a, y = rng.randint(2, 9), rng.randint(2, 12)
    text = ("GLIDER CHASE\n\n"
            f"The Goblin Glider flies Y metres every second.\nIn {a} seconds it covers {a * y} metres.\n\n"
            "How many metres does it fly each second?")
    hint = f"{a}Y = {a * y}. Divide both sides by {a}."
    return _build(text, y, [a * y - a, a * y + a, y + 1, y - 1], hint, rng)


def _goblin_vault(rng):  # aY ± b = c
    a, y = rng.randint(2, 10), rng.randint(2, 11)
    add = _coin(rng)
    b = rng.randint(1, 20) if add else rng.randint(1, min(20, a * y - 1))
    c = a * y + b if add else a * y - b
    text = ("OSCORP VAULT\n\n"
            "Norman Osborn locked the Oscorp vault with a secret number Y.\n"
            f"The clue says: {a} times Y, {'plus' if add else 'minus'} {b}, equals {c}.\n\n"
            "Find Y to open the vault.")
    hint = (f"{a}Y {'+' if add else '-'} {b} = {c}. {'Subtract' if add else 'Add'} {b} on both sides first, "
            f"then divide by {a}.")
    return _build(text, y, [y + 1, y - 1, y + 2, y * 2], hint, rng)


def _goblin_serum(rng):  # aY - b = c
    a, y = rng.randint(2, 9), rng.randint(3, 12)
    b = rng.randint(1, min(20, a * y - 1))
    c = a * y - b
    text = ("GOBLIN SERUM\n\n"
            f"Each vial holds Y drops of Goblin serum.\n{a} vials were filled and {b} drops spilled, leaving {c} drops.\n\n"
            "How many drops does one vial hold?")
    hint = f"{a}Y - {b} = {c}. Add {b} to both sides first, then divide by {a}."
    return _build(text, y, [y + 1, y - 1, y + 2, c // a], hint, rng)


def _goblin_race(rng):  # aY + b = cY + d
    y = rng.randint(2, 12)
    c = rng.randint(1, 5)
    a = c + rng.randint(1, 5)
    b = rng.randint(1, 12)
    d = (a - c) * y + b
    text = ("GLIDER RACE\n\n"
            f"Spider-Man swings {a}Y + {b} metres. The Goblin Glider flies {c}Y + {d} metres.\n"
            "They travel the same distance.\n\nFind Y.")
    hint = (f"{a}Y + {b} = {c}Y + {d}. Subtract {c}Y from both sides, then subtract {b}, then divide.")
    return _build(text, y, [d - b, y + 1, y - 1, y * 2], hint, rng)


def _goblin_crates(rng):  # a(Y + b) = c
    a, b, y = rng.randint(2, 6), rng.randint(1, 9), rng.randint(2, 12)
    c = a * (y + b)
    text = ("PUMPKIN CRATES\n\n"
            f"Goblin packs {a} crates. Each crate holds Y pumpkin bombs and {b} smoke bombs.\n"
            f"There are {c} bombs in total.\n\nFind Y.")
    hint = f"{a}(Y + {b}) = {c}. Divide both sides by {a} first, then subtract {b}."
    return _build(text, y, [c // a, y + b + 1, y + 1, y - 1], hint, rng)


# ── Doctor Octopus: area and perimeter ───────────────────────────────────────
def _ock_plate(rng):
    w = rng.randint(2, 6)
    length = w + rng.randint(1, 4)
    area = w * length
    text = ("TENTACLE GRIP\n\n"
            f"Doc Ock's four metal arms hold a steel plate {w}m wide and {length}m long.\n\n"
            "What is the Area of the plate?")
    hint = f"Area of a rectangle is width x length. Multiply {w} by {length}."
    return _build(text, area, [w + length, 2 * (w + length), area + 10, area - 5], hint, rng)


def _ock_fence(rng):
    w = rng.randint(2, 6)
    length = w + rng.randint(1, 4)
    perimeter = 2 * (w + length)
    text = ("LASER FENCE\n\n"
            f"Doctor Octopus runs a laser fence around a floor {w}m wide and {length}m long.\n\n"
            "What is the Perimeter of the floor?")
    hint = f"Perimeter of a rectangle is 2 x (width + length). Add {w} and {length}, then double it."
    return _build(text, perimeter, [w * length, w + length, perimeter + 2, perimeter - 4], hint, rng)


def _ock_shield(rng):
    side = rng.randint(3, 15)
    text = ("FUSION REACTOR\n\n"
            f"Otto Octavius builds a square shield around his reactor. Each side is {side}m.\n\n"
            "What is the Perimeter of the shield?")
    hint = f"A square has four equal sides. Add {side} four times."
    return _build(text, 4 * side, [side * side, 2 * side, 4 * side + 4, 3 * side], hint, rng)


def _ock_hatch(rng):
    side = rng.randint(3, 12)
    text = ("ESCAPE HATCH\n\n"
            f"Doc Ock's arms cut a square hatch with sides of {side}m.\n\n"
            "What is the Area of the hatch?")
    hint = f"Area of a square is side x side. Multiply {side} by {side}, not by 4."
    return _build(text, side * side, [4 * side, 2 * side, side * side + side, side * side - side], hint, rng)


def _ock_reach(rng):
    base, height = 2 * rng.randint(2, 8), rng.randint(3, 12)
    area = base * height // 2
    text = ("TENTACLE REACH\n\n"
            f"Doc Ock's arms sweep a triangular zone with a base of {base}m and a height of {height}m.\n\n"
            "What is the Area of the zone?")
    hint = f"Area of a triangle is half of base x height. Multiply {base} by {height}, then halve it."
    return _build(text, area, [base * height, base + height, area + base, area - 2], hint, rng)


def _ock_reactor_room(rng):
    w = rng.randint(3, 9)
    length = w + rng.randint(1, 8)
    area, perimeter = w * length, 2 * (w + length)
    text = ("REACTOR ROOM\n\n"
            f"The reactor room is a rectangle with an Area of {area} sq m and a width of {w}m.\n\n"
            "What is its Perimeter?")
    hint = (f"Find the length first: {area} divided by {w}. "
            "Then add the width and the length, and double it.")
    return _build(text, perimeter, [length, w + length, 2 * area, perimeter + 2 * w], hint, rng)


# ── Mysterio: sequences and patterns ─────────────────────────────────────────
def _next_in(title: str, story: str, ask: str, seq: List[int], nxt: int, wrong: List[int], hint: str, rng):
    text = (f"{title}\n\n{story}\n"
            f"Observe the sequence: {seq[0]}, {seq[1]}, {seq[2]}, {seq[3]}...\n\n{ask}")
    return _build(text, nxt, wrong, hint, rng)


def _add_hint() -> str:
    return "Look for an addition pattern. What do you add to each number to get the next?"


def _mysterio_helmet(rng):
    start, diff = rng.randint(1, 5), rng.randint(2, 5)
    seq = [start + diff * i for i in range(4)]
    nxt = seq[3] + diff
    return _next_in("FISHBOWL TRICK", "Mysterio's fishbowl helmet flashes in a pattern.",
                    "How many flashes come next?", seq, nxt, [nxt + 1, nxt - 2, nxt + diff, nxt * 2], _add_hint(), rng)


def _mysterio_smoke(rng):
    start, diff = rng.randint(1, 5), rng.randint(2, 5)
    seq = [start + diff * i for i in range(4)]
    nxt = seq[3] + diff
    return _next_in("SMOKE SCREEN", "Mysterio releases more smoke clouds every round.",
                    "How many clouds come next?", seq, nxt, [nxt + 1, nxt - 2, nxt + diff, nxt * 2], _add_hint(), rng)


def _mysterio_army(rng):
    start, ratio = rng.randint(2, 6), rng.randint(2, 3)
    seq = [start * ratio ** i for i in range(4)]
    nxt = seq[3] * ratio
    hint = "Look for a multiplication pattern. What do you multiply each number by to get the next?"
    return _next_in("ILLUSION ARMY", "Mysterio's fake Spider-Men multiply every minute.",
                    "How many appear next?", seq, nxt, [nxt + ratio, nxt - ratio, nxt * 2, nxt + start], hint, rng)


def _mysterio_drones(rng):
    start, diff = rng.randint(2, 6), rng.randint(3, 12)
    seq = [start + diff * i for i in range(4)]
    nxt = seq[3] + diff
    return _next_in("DRONE WAVES", "Quentin Beck launches his illusion drones in waves.",
                    "How many drones are in the next wave?", seq, nxt, [nxt + 1, nxt - 2, nxt + diff, nxt * 2],
                    _add_hint(), rng)


def _mysterio_tower(rng):
    start, diff, n = rng.randint(2, 9), rng.randint(3, 9), rng.choice([8, 9, 10, 12])
    seq = [start + diff * i for i in range(4)]
    answer = start + (n - 1) * diff
    text = ("HOLOGRAM TOWER\n\nBeck stacks hologram projectors floor by floor.\n"
            f"Observe the sequence: {seq[0]}, {seq[1]}, {seq[2]}, {seq[3]}...\n\n"
            f"What is the {n}th number in the sequence?")
    hint = (f"Each step adds {diff}. To reach the {n}th number from the 1st you take {n - 1} steps, "
            "not " + str(n) + ".")
    return _build(text, answer, [start + n * diff, answer - diff, n * diff, answer + start], hint, rng)


def _mysterio_mirror(rng):
    start, diff = rng.randint(2, 9), rng.randint(3, 9)
    seq = [start + diff * i for i in range(5)]
    text = ("MIRROR MAZE\n\nOne mirror in Mysterio's maze is hiding a number.\n"
            f"Observe the pattern: {seq[0]}, {seq[1]}, ?, {seq[3]}, {seq[4]}\n\n"
            "Which number is hidden?")
    hint = "Find what is added from the first number to the second. Add it once more to the second number."
    return _build(text, seq[2], [seq[2] + 1, seq[2] - 1, seq[0] + seq[1], seq[3] - 1], hint, rng)


# ── Venom: percentages ───────────────────────────────────────────────────────
def _venom_cells(rng):
    percent, total = rng.choice([10, 25, 50]), rng.randint(1, 10) * 20
    part = percent * total // 100
    text = ("SYMBIOTE BOND\n\n"
            f"The symbiote has bonded with {percent}% of Eddie Brock's {total} cells in a sample.\n\n"
            "How many cells are bonded?")
    hint = f"To find {percent}% of {total}, divide {percent} by 100 and multiply by {total}."
    return _build(text, part, [part + 10, part - 20, total - part, part * 2], hint, rng)


def _venom_bell(rng):
    percent, total = rng.choice([10, 25, 50]), rng.randint(1, 10) * 20
    part = percent * total // 100
    text = ("BELL TOWER\n\n"
            f"Loud sound weakens Venom. A church bell removes {percent}% of his {total} strength points.\n\n"
            "How many strength points does he lose?")
    hint = f"To find {percent}% of {total}, divide {percent} by 100 and multiply by {total}."
    return _build(text, part, [part + 10, part - 20, total - part, part * 2], hint, rng)


def _venom_web_fluid(rng):
    percent, total = rng.randint(1, 4) * 15, rng.randint(2, 6) * 100
    part = percent * total // 100
    text = ("WEB FLUID\n\n"
            f"Spider-Man has {total} ml of web fluid. Venom's attack burns {percent}% of it.\n\n"
            "How many ml are burned?")
    hint = f"To find {percent}% of {total}, divide {percent} by 100 and multiply by {total}."
    return _build(text, part, [part + 10, part - 20, total - part, part * 2], hint, rng)


def _venom_sonic(rng):
    percent, total = rng.randint(1, 4) * 15, rng.randint(2, 6) * 100
    part = percent * total // 100
    text = ("SONIC BLAST\n\n"
            f"A sonic blast strips away {percent}% of the symbiote's {total} grams.\n\n"
            "How many grams are stripped away?")
    hint = f"To find {percent}% of {total}, divide {percent} by 100 and multiply by {total}."
    return _build(text, part, [part + 10, part - 20, total - part, part * 2], hint, rng)


def _venom_growth(rng):
    base, percent = rng.randint(2, 6) * 100, rng.choice([10, 20, 25, 40])
    answer = base * (100 + percent) // 100
    text = ("SYMBIOTE GROWTH\n\n"
            f"Venom weighed {base} kg. After absorbing energy he grew by {percent}%.\n\n"
            "How many kg does he weigh now?")
    hint = f"Find {percent}% of {base} first, then add it on to the {base}."
    wrong = [base * percent // 100, base + percent, base * (100 - percent) // 100, answer + 10]
    return _build(text, answer, wrong, hint, rng)


def _venom_photos(rng):
    total, percent = rng.choice([20, 40, 50, 200]), rng.choice([20, 30, 40, 60, 70, 80])
    part = total * percent // 100
    text = ("NEWSROOM\n\n"
            f"Reporter Eddie Brock checked {total} photos and {part} were of Spider-Man.\n\n"
            "What percentage were of Spider-Man?")
    hint = f"Divide the part by the whole, {part} / {total}, then multiply by 100."
    return _build(text, percent, [part, 100 - percent, percent + 10, percent - 10], hint, rng)


# ── The Lizard: exponents and radicals ───────────────────────────────────────
def _lizard_tiles(rng):
    base = rng.randint(2, 9)
    answer = base * base
    text = ("SEWER LAIR\n\n"
            f"The Lizard's sewer lair has a square floor with {base} tiles along each side.\n\n"
            f"How many tiles is that?  {base}^2 = ?")
    hint = f"{base}^2 means {base} multiplied by itself, not {base} times 2."
    return _build(text, answer, [base * 2, answer + base, answer - 1, base + 2], hint, rng)


def _lizard_cages(rng):
    root = rng.randint(2, 10)
    text = ("LAB CAGES\n\n"
            f"Dr. Connors arranges {root * root} lizard cages in a perfect square.\n\n"
            f"How many cages are along one side?  √{root * root} = ?")
    hint = f"Which number multiplied by itself gives {root * root}?"
    return _build(text, root, [root * root // 2, root + 1, root - 1, root * 2], hint, rng)


def _lizard_regrowth(rng):
    base, exp, root = rng.randint(2, 5), rng.randint(2, 3), rng.randint(2, 9)
    answer = base ** exp + root
    text = ("REGROWTH SERUM\n\n"
            "Dr. Connors' serum grows new cells and repairs old ones.\n\n"
            f"How many cells in total?  {base}^{exp} + √{root * root} = ?")
    hint = (f"Work out {base}^{exp} first ({base} multiplied by itself {exp} times), "
            f"then the square root of {root * root}, then add.")
    return _build(text, answer, [answer + 2, answer - 2, answer + base, answer * 2], hint, rng)


def _lizard_scales(rng):
    base, exp, root = rng.randint(2, 5), rng.randint(2, 3), rng.randint(2, 9)
    while base ** exp <= root:  # keep the answer positive
        root -= 1
    answer = base ** exp - root
    text = ("SHEDDING SCALES\n\n"
            "The Lizard sheds scales, and a few grow back.\n\n"
            f"How many scales are gone?  {base}^{exp} - √{root * root} = ?")
    hint = (f"Work out {base}^{exp} first ({base} multiplied by itself {exp} times), "
            f"then the square root of {root * root}, then subtract.")
    return _build(text, answer, [answer + 2, answer - 2, answer + base, answer * 2], hint, rng)


def _lizard_splitting(rng):
    base, m, n = rng.randint(2, 3), rng.randint(1, 3), rng.randint(2, 3)
    answer = base ** (m + n)
    text = ("SPLITTING CELLS\n\n"
            "The Lizard's mutated cells keep splitting in stages.\n\n"
            f"How many cells are there?  {base}^{m} × {base}^{n} = ?")
    hint = f"Same base, so add the powers: {base}^{m} × {base}^{n} = {base}^({m}+{n})."
    return _build(text, answer, [base ** (m * n), (base * base) ** (m + n), base * (m + n), answer + base], hint, rng)


def _lizard_waves(rng):
    base, m = rng.randint(2, 3), rng.randint(2, 3)
    answer = base ** (2 * m)
    text = ("MUTATION WAVE\n\n"
            "Each mutation wave squares the number of reptile cells.\n\n"
            f"How many cells after one wave?  ({base}^{m})^2 = ?")
    hint = f"A power of a power multiplies the powers: ({base}^{m})^2 = {base}^({m}×2)."
    return _build(text, answer, [base ** (m + 2), base ** m * 2, base * m * 2, answer - base], hint, rng)


# ── Kingpin: ratios and proportions ──────────────────────────────────────────
def _kingpin_guards(rng):
    each, inside = rng.randint(2, 6), rng.randint(2, 9)
    answer = each * inside
    text = ("FISK TOWER\n\n"
            f"For every 1 guard inside Fisk Tower, Kingpin posts {each} outside.\nThere are {inside} guards inside.\n\n"
            "How many guards are outside?")
    hint = f"Each guard inside is matched by {each} outside. Multiply {inside} by {each}."
    return _build(text, answer, [each + inside, answer + each, answer - 1, inside], hint, rng)


def _kingpin_chips(rng):
    each, gold = rng.randint(2, 6), rng.randint(2, 9)
    answer = each * gold
    text = ("CASINO CHIPS\n\n"
            f"In Kingpin's casino, 1 gold chip is worth {each} silver chips.\n\n"
            f"How many silver chips are {gold} gold chips worth?")
    hint = f"Every gold chip gives {each} silver chips. Multiply {gold} by {each}."
    return _build(text, answer, [each + gold, answer + each, answer - 1, gold], hint, rng)


def _kingpin_trucks(rng):
    x1, y1, k = rng.randint(2, 6), rng.randint(3, 7), rng.randint(2, 5)
    x2, answer = x1 * k, y1 * k
    text = ("SMUGGLING ROUTE\n\n"
            f"Wilson Fisk's trucks carry {x1} crates for every {y1} barrels.\nA convoy carries {x2} crates.\n\n"
            "How many barrels does it carry?")
    hint = f"{x1} multiplied by what gives {x2}? Multiply {y1} by that same number."
    return _build(text, answer, [answer + y1, answer - x1, x2, answer * 2], hint, rng)


def _kingpin_bodyguards(rng):
    x1, y1, k = rng.randint(2, 6), rng.randint(3, 7), rng.randint(2, 5)
    x2, answer = x1 * k, y1 * k
    text = ("FISK'S CREW\n\n"
            f"Kingpin hires {x1} bodyguards for every {y1} lawyers.\nHe has {x2} bodyguards.\n\n"
            "How many lawyers does he have?")
    hint = f"{x1} multiplied by what gives {x2}? Multiply {y1} by that same number."
    return _build(text, answer, [answer + y1, answer - x1, x2, answer * 2], hint, rng)


def _ratio_parts(rng):
    a = rng.randint(2, 7)
    b = rng.choice([n for n in range(2, 8) if n != a])
    return a, b, rng.randint(5, 20)


def _kingpin_blocks(rng):
    a, b, k = _ratio_parts(rng)
    total, answer = (a + b) * k, a * k
    text = ("CITY TAKEOVER\n\n"
            f"Kingpin controls {total} city blocks. He shares them with Hammerhead in the ratio {a} : {b}.\n\n"
            "How many blocks does Kingpin keep?")
    hint = (f"The ratio has {a} + {b} = {a + b} equal parts. Find the size of one part, "
            f"then take {a} of them.")
    return _build(text, answer, [b * k, total // a, total // (a + b), total - a], hint, rng)


def _kingpin_fortune(rng):
    a, b, k = _ratio_parts(rng)
    total, answer = (a + b) * k, b * k
    text = ("FISK FORTUNE\n\n"
            f"Wilson Fisk and Vanessa share ${total} in the ratio {a} : {b}.\n\n"
            "How many dollars does Vanessa get?")
    hint = (f"The ratio has {a} + {b} = {a + b} equal parts. Find the size of one part. "
            f"Vanessa's share is the second number, so take {b} of them.")
    return _build(text, answer, [a * k, total // b, total // (a + b), total - b], hint, rng)


Story = Callable[[random.Random], GeneratedQuestion]

# Six stories per villain: two for each difficulty tier.
STORIES: Dict[str, Dict[str, List[Story]]] = {
    "goblin": {"easy": [_goblin_bombs, _goblin_glider], "medium": [_goblin_vault, _goblin_serum],
               "hard": [_goblin_race, _goblin_crates]},
    "doc-ock": {"easy": [_ock_plate, _ock_fence], "medium": [_ock_shield, _ock_hatch],
                "hard": [_ock_reach, _ock_reactor_room]},
    "mysterio": {"easy": [_mysterio_helmet, _mysterio_smoke], "medium": [_mysterio_army, _mysterio_drones],
                 "hard": [_mysterio_tower, _mysterio_mirror]},
    "venom": {"easy": [_venom_cells, _venom_bell], "medium": [_venom_web_fluid, _venom_sonic],
              "hard": [_venom_growth, _venom_photos]},
    "lizard": {"easy": [_lizard_tiles, _lizard_cages], "medium": [_lizard_regrowth, _lizard_scales],
               "hard": [_lizard_splitting, _lizard_waves]},
    "kingpin": {"easy": [_kingpin_guards, _kingpin_chips], "medium": [_kingpin_trucks, _kingpin_bodyguards],
                "hard": [_kingpin_blocks, _kingpin_fortune]},
}
