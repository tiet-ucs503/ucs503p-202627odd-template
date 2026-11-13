"""The six bosses and the maths topic each one teaches. Order = unlock order."""
from typing import Dict, List, Optional

BOSSES: List[Dict[str, str]] = [
    {"id": "goblin", "name": "Green Goblin", "topic": "linear_equations", "label": "Algebra (Linear Equations)",
     "key_idea": "Do the same operation to both sides; undo + or - first, then divide."},
    {"id": "doc-ock", "name": "Doctor Octopus", "topic": "area_perimeter", "label": "Geometry (Area & Perimeter)",
     "key_idea": "Rectangle area = width x length; perimeter = 2 x (width + length); triangle area = half of base x height."},
    {"id": "mysterio", "name": "Mysterio", "topic": "sequences_patterns", "label": "Number Patterns & Sequences",
     "key_idea": "Arithmetic sequences add the same amount each step; geometric sequences multiply by the same amount."},
    {"id": "venom", "name": "Venom", "topic": "percentages", "label": "Percentages",
     "key_idea": "P% of a number = P / 100 x the number; a part as a percentage = part / whole x 100."},
    {"id": "lizard", "name": "The Lizard", "topic": "exponents_radicals", "label": "Exponents & Radicals",
     "key_idea": "a^n means a multiplied by itself n times; same base multiplied: add the powers; a square root undoes squaring."},
    {"id": "kingpin", "name": "Kingpin", "topic": "ratios_proportions", "label": "Ratios & Proportions",
     "key_idea": "Equal ratios scale both numbers by the same factor; to share in a ratio, find the size of one part first."},
]

BOSS_IDS: List[str] = [b["id"] for b in BOSSES]
_BY_ID = {b["id"]: b for b in BOSSES}
_BY_TOPIC = {b["topic"]: b for b in BOSSES}


def get_boss(boss_id: str) -> Optional[Dict[str, str]]:
    return _BY_ID.get(boss_id)


def boss_for_topic(topic: str) -> Dict[str, str]:
    return _BY_TOPIC[topic]


def unlocked_bosses(level: int) -> List[str]:
    """A student at level N may play the first N bosses."""
    return BOSS_IDS[: max(1, min(level, len(BOSS_IDS)))]
