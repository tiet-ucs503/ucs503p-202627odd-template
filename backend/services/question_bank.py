"""
A fixed backup set of questions: six per villain, two for each difficulty tier.

The game normally builds every question from random numbers
(services/questions.py and services/story_questions.py). That needs no outside
service, so there is nothing to go down. This bank exists for the one
remaining case: if the generator itself ever raises an unexpected error, the
mission carries on with one of these instead of failing.

Each entry was written and checked by hand, and tests/test_question_bank.py
re-solves every one from its text. No AI service is involved anywhere.
"""
import logging
import random
from typing import Dict, List, NamedTuple, Optional

from services.questions import DIFFICULTIES, GeneratedQuestion, generate_question

logger = logging.getLogger(__name__)


class BankQuestion(NamedTuple):
    difficulty: str
    text: str
    answer: int
    wrong: List[int]  # exactly three, all different from the answer and each other
    hint: str


def _q(difficulty, text, answer, wrong, hint) -> BankQuestion:
    return BankQuestion(difficulty, text, answer, wrong, hint)


BANK: Dict[str, List[BankQuestion]] = {
    "goblin": [
        _q("easy", "PUMPKIN BOMB ALERT\n\nGreen Goblin loaded Y pumpkin bombs onto his glider, then grabbed 6 more.\n"
                   "Now he carries 15.\n\nHow many did he load first?",
           9, [21, 8, 10], "Y + 6 = 15. Undo the + 6: subtract 6 from both sides."),
        _q("easy", "GLIDER CHASE\n\nThe Goblin Glider flies Y metres every second.\nIn 4 seconds it covers 28 metres.\n\n"
                   "How many metres does it fly each second?",
           7, [24, 32, 6], "4Y = 28. Divide both sides by 4."),
        _q("medium", "OSCORP VAULT\n\nNorman Osborn locked the Oscorp vault with a secret number Y.\n"
                     "The clue says: 3 times Y, plus 5, equals 26.\n\nFind Y to open the vault.",
           7, [8, 6, 10], "3Y + 5 = 26. Subtract 5 on both sides first, then divide by 3."),
        _q("medium", "GOBLIN SERUM\n\nEach vial holds Y drops of Goblin serum.\n"
                     "5 vials were filled and 4 drops spilled, leaving 36 drops.\n\nHow many drops does one vial hold?",
           8, [7, 9, 6], "5Y - 4 = 36. Add 4 to both sides first, then divide by 5."),
        _q("hard", "GLIDER RACE\n\nSpider-Man swings 5Y + 3 metres. The Goblin Glider flies 2Y + 18 metres.\n"
                   "They travel the same distance.\n\nFind Y.",
           5, [15, 6, 7], "5Y + 3 = 2Y + 18. Subtract 2Y from both sides, then subtract 3, then divide."),
        _q("hard", "PUMPKIN CRATES\n\nGoblin packs 4 crates. Each crate holds Y pumpkin bombs and 3 smoke bombs.\n"
                   "There are 40 bombs in total.\n\nFind Y.",
           7, [10, 13, 8], "4(Y + 3) = 40. Divide both sides by 4 first, then subtract 3."),
    ],
    "doc-ock": [
        _q("easy", "TENTACLE GRIP\n\nDoc Ock's four metal arms hold a steel plate 3m wide and 5m long.\n\n"
                   "What is the Area of the plate?",
           15, [8, 16, 20], "Area of a rectangle is width x length. Multiply 3 by 5."),
        _q("easy", "LASER FENCE\n\nDoctor Octopus runs a laser fence around a floor 4m wide and 6m long.\n\n"
                   "What is the Perimeter of the floor?",
           20, [24, 10, 16], "Perimeter of a rectangle is 2 x (width + length). Add 4 and 6, then double it."),
        _q("medium", "FUSION REACTOR\n\nOtto Octavius builds a square shield around his reactor. Each side is 7m.\n\n"
                     "What is the Perimeter of the shield?",
           28, [49, 14, 21], "A square has four equal sides. Add 7 four times."),
        _q("medium", "ESCAPE HATCH\n\nDoc Ock's arms cut a square hatch with sides of 6m.\n\n"
                     "What is the Area of the hatch?",
           36, [24, 12, 30], "Area of a square is side x side. Multiply 6 by 6, not by 4."),
        _q("hard", "TENTACLE REACH\n\nDoc Ock's arms sweep a triangular zone with a base of 8m and a height of 5m.\n\n"
                   "What is the Area of the zone?",
           20, [40, 13, 28], "Area of a triangle is half of base x height. Multiply 8 by 5, then halve it."),
        _q("hard", "REACTOR ROOM\n\nThe reactor room is a rectangle with an Area of 48 sq m and a width of 6m.\n\n"
                   "What is its Perimeter?",
           28, [8, 14, 96], "Find the length first: 48 divided by 6. Then add the width and the length, and double it."),
    ],
    "mysterio": [
        _q("easy", "FISHBOWL TRICK\n\nMysterio's fishbowl helmet flashes in a pattern.\n"
                   "Observe the sequence: 2, 5, 8, 11...\n\nHow many flashes come next?",
           14, [15, 12, 13], "Look for an addition pattern. What do you add to each number to get the next?"),
        _q("easy", "SMOKE SCREEN\n\nMysterio releases more smoke clouds every round.\n"
                   "Observe the sequence: 4, 8, 12, 16...\n\nHow many clouds come next?",
           20, [18, 24, 32], "Look for an addition pattern. What do you add to each number to get the next?"),
        _q("medium", "ILLUSION ARMY\n\nMysterio's fake Spider-Men multiply every minute.\n"
                     "Observe the sequence: 3, 6, 12, 24...\n\nHow many appear next?",
           48, [36, 30, 27], "Look for a multiplication pattern. What do you multiply each number by to get the next?"),
        _q("medium", "DRONE WAVES\n\nQuentin Beck launches his illusion drones in waves.\n"
                     "Observe the sequence: 5, 12, 19, 26...\n\nHow many drones are in the next wave?",
           33, [31, 34, 40], "Look for an addition pattern. What do you add to each number to get the next?"),
        _q("hard", "HOLOGRAM TOWER\n\nBeck stacks hologram projectors floor by floor.\n"
                   "Observe the sequence: 4, 9, 14, 19...\n\nWhat is the 10th number in the sequence?",
           49, [54, 44, 50], "Each step adds 5. To reach the 10th number from the 1st you take 9 steps, not 10."),
        _q("hard", "MIRROR MAZE\n\nOne mirror in Mysterio's maze is hiding a number.\n"
                   "Observe the pattern: 6, 13, ?, 27, 34\n\nWhich number is hidden?",
           20, [19, 21, 26], "Find what is added from the first number to the second. Add it once more to the second number."),
    ],
    "venom": [
        _q("easy", "SYMBIOTE BOND\n\nThe symbiote has bonded with 25% of Eddie Brock's 80 cells in a sample.\n\n"
                   "How many cells are bonded?",
           20, [25, 60, 40], "To find 25% of 80, divide 25 by 100 and multiply by 80."),
        _q("easy", "BELL TOWER\n\nLoud sound weakens Venom. A church bell removes 50% of his 120 strength points.\n\n"
                   "How many strength points does he lose?",
           60, [50, 70, 240], "To find 50% of 120, divide 50 by 100 and multiply by 120."),
        _q("medium", "WEB FLUID\n\nSpider-Man has 300 ml of web fluid. Venom's attack burns 30% of it.\n\n"
                     "How many ml are burned?",
           90, [30, 210, 100], "To find 30% of 300, divide 30 by 100 and multiply by 300."),
        _q("medium", "SONIC BLAST\n\nA sonic blast strips away 45% of the symbiote's 200 grams.\n\n"
                     "How many grams are stripped away?",
           90, [45, 110, 245], "To find 45% of 200, divide 45 by 100 and multiply by 200."),
        _q("hard", "SYMBIOTE GROWTH\n\nVenom weighed 400 kg. After absorbing energy he grew by 25%.\n\n"
                   "How many kg does he weigh now?",
           500, [100, 425, 300], "Find 25% of 400 first, then add it on to the 400."),
        _q("hard", "NEWSROOM\n\nReporter Eddie Brock checked 50 photos and 30 were of Spider-Man.\n\n"
                   "What percentage were of Spider-Man?",
           60, [30, 40, 20], "Divide the part by the whole, 30 / 50, then multiply by 100."),
    ],
    "lizard": [
        _q("easy", "SEWER LAIR\n\nThe Lizard's sewer lair has a square floor with 6 tiles along each side.\n\n"
                   "How many tiles is that?  6^2 = ?",
           36, [12, 42, 35], "6^2 means 6 multiplied by itself, not 6 times 2."),
        _q("easy", "LAB CAGES\n\nDr. Connors arranges 49 lizard cages in a perfect square.\n\n"
                   "How many cages are along one side?  √49 = ?",
           7, [24, 8, 14], "Which number multiplied by itself gives 49?"),
        _q("medium", "REGROWTH SERUM\n\nDr. Connors' serum grows new cells and repairs old ones.\n\n"
                     "How many cells in total?  3^3 + √16 = ?",
           31, [13, 33, 23], "Work out 3^3 first (3 multiplied by itself 3 times), then the square root of 16, then add."),
        _q("medium", "SHEDDING SCALES\n\nThe Lizard sheds scales, and a few grow back.\n\n"
                     "How many scales are gone?  4^2 - √9 = ?",
           13, [5, 19, 11], "Work out 4^2 first (4 multiplied by itself 2 times), then the square root of 9, then subtract."),
        _q("hard", "SPLITTING CELLS\n\nThe Lizard's mutated cells keep splitting in stages.\n\n"
                   "How many cells are there?  2^2 × 2^3 = ?",
           32, [64, 10, 12], "Same base, so add the powers: 2^2 × 2^3 = 2^(2+3)."),
        _q("hard", "MUTATION WAVE\n\nEach mutation wave squares the number of reptile cells.\n\n"
                   "How many cells after one wave?  (3^2)^2 = ?",
           81, [27, 18, 12], "A power of a power multiplies the powers: (3^2)^2 = 3^(2×2)."),
    ],
    "kingpin": [
        _q("easy", "FISK TOWER\n\nFor every 1 guard inside Fisk Tower, Kingpin posts 3 outside.\nThere are 7 guards inside.\n\n"
                   "How many guards are outside?",
           21, [10, 24, 20], "Each guard inside is matched by 3 outside. Multiply 7 by 3."),
        _q("easy", "CASINO CHIPS\n\nIn Kingpin's casino, 1 gold chip is worth 5 silver chips.\n\n"
                   "How many silver chips are 6 gold chips worth?",
           30, [11, 35, 25], "Every gold chip gives 5 silver chips. Multiply 6 by 5."),
        _q("medium", "SMUGGLING ROUTE\n\nWilson Fisk's trucks carry 3 crates for every 4 barrels.\nA convoy carries 12 crates.\n\n"
                     "How many barrels does it carry?",
           16, [20, 13, 9], "3 multiplied by what gives 12? Multiply 4 by that same number."),
        _q("medium", "FISK'S CREW\n\nKingpin hires 2 bodyguards for every 5 lawyers.\nHe has 8 bodyguards.\n\n"
                     "How many lawyers does he have?",
           20, [25, 18, 16], "2 multiplied by what gives 8? Multiply 5 by that same number."),
        _q("hard", "CITY TAKEOVER\n\nKingpin controls 60 city blocks. He shares them with Hammerhead in the ratio 3 : 2.\n\n"
                   "How many blocks does Kingpin keep?",
           36, [24, 20, 12], "The ratio has 3 + 2 = 5 equal parts. Find the size of one part, then take 3 of them."),
        _q("hard", "FISK FORTUNE\n\nWilson Fisk and Vanessa share $90 in the ratio 4 : 5.\n\n"
                   "How many dollars does Vanessa get?",
           50, [40, 18, 10],
           "The ratio has 4 + 5 = 9 equal parts. Find the size of one part. "
           "Vanessa's share is the second number, so take 5 of them."),
    ],
}


def backup_question(boss_id: str, difficulty: str = "medium",
                    rng: Optional[random.Random] = None) -> GeneratedQuestion:
    """One of the fixed questions for this villain and tier, with its options shuffled."""
    if boss_id not in BANK:
        raise ValueError(f"Unknown boss: {boss_id}")
    if difficulty not in DIFFICULTIES:
        raise ValueError(f"Unknown difficulty: {difficulty}")
    rng = rng or random.Random()
    chosen = rng.choice([q for q in BANK[boss_id] if q.difficulty == difficulty])
    options = [chosen.answer, *chosen.wrong]
    rng.shuffle(options)
    return GeneratedQuestion(
        text=chosen.text,
        options=[str(o) for o in options],
        correct_index=options.index(chosen.answer),
        hint=chosen.hint,
        difficulty=difficulty,
    )


def question_or_backup(boss_id: str, difficulty: str = "medium",
                       rng: Optional[random.Random] = None) -> GeneratedQuestion:
    """
    The question to serve. Normally a freshly generated one. If the generator
    fails for any unexpected reason, a fixed backup question is served instead
    so the mission can continue. An unknown villain or tier is still an error.
    """
    try:
        return generate_question(boss_id, difficulty, rng)
    except ValueError:
        raise
    except Exception:
        logger.exception("Question generator failed for %s/%s; serving a backup question", boss_id, difficulty)
        return backup_question(boss_id, difficulty, rng)
